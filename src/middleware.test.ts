import { afterAll, beforeAll, describe, expect, test } from "bun:test";

// The real bug this proves against: a browser holding a signature-valid
// cookie for an account that no longer exists got stuck in an infinite
// redirect loop (ERR_TOO_MANY_REDIRECTS between "/" and "/login"), because
// middleware only checked the cookie's signature/age, never whether the
// account still existed — resolveSessionUserId's existence check was wired
// into requireUserId/getUserId (page-level), but pages render with a
// read-only cookie store, so the stale cookie was never actually cleared and
// middleware kept calling it valid forever. Fixed by making middleware do
// the same existence check and clear the cookie itself, the one place a
// delete is guaranteed to stick. See src/middleware.ts's own comment.
//
// Needs a real Postgres and a real AUTH_SECRET (to sign a cookie the same
// way login does), so it skips when either is absent — same convention as
// src/db/habits.test.ts.

const LIVE = Boolean(process.env.DATABASE_URL && process.env.AUTH_SECRET);

let AuthCookie: string;
let Middleware: typeof import("./middleware");

const stamp = Date.now().toString(36);
const NAME = `middleware-test-${stamp}`;

describe.skipIf(!LIVE)("middleware — session existence check", () => {
  let liveUserId: number;
  let staleCookieValue: string;
  let liveCookieValue: string;

  beforeAll(async () => {
    const [{ middleware }, { AUTH_COOKIE, createAuthCookieValue }, { createUser }] =
      await Promise.all([
        import("./middleware"),
        import("@/lib/auth"),
        import("@/db/users"),
      ]);
    Middleware = { middleware } as unknown as typeof import("./middleware");
    AuthCookie = AUTH_COOKIE;

    // Two accounts: one that stays alive (proves the normal-auth path still
    // works), one that gets deleted right after signing its cookie (proves
    // the stale-cookie path).
    const liveCreated = await createUser(NAME);
    const staleCreated = await createUser(`${NAME}-stale`);
    if (liveCreated === null || staleCreated === null) {
      throw new Error("could not create test users");
    }
    liveUserId = liveCreated;
    liveCookieValue = await createAuthCookieValue(liveUserId, process.env.AUTH_SECRET!);
    staleCookieValue = await createAuthCookieValue(staleCreated, process.env.AUTH_SECRET!);

    const { db } = await import("@/db/index");
    const { users } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(users).where(eq(users.id, staleCreated));
  });

  afterAll(async () => {
    if (!LIVE) return;
    const { db } = await import("@/db/index");
    const { users } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(users).where(eq(users.id, liveUserId));
  });

  function requestWithCookie(path: string, cookieValue: string): Request {
    return new Request(`https://example.test${path}`, {
      headers: { cookie: `${AuthCookie}=${cookieValue}` },
    });
  }

  test("a stale cookie (account deleted) does not bounce /login back to /", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(requestWithCookie("/login", staleCookieValue));
    const res = await Middleware.middleware(req);

    // Before the fix: middleware saw the signature as valid, treated this as
    // an authed visitor to a public path, and redirected straight to "/" —
    // which would in turn bounce back to "/login", forever.
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).not.toBe(307);
  });

  test("a stale cookie is actually cleared, not just ignored", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(requestWithCookie("/", staleCookieValue));
    const res = await Middleware.middleware(req);

    // Protected path, no valid session → redirected to /login, same as an
    // unauthenticated visitor.
    expect(res.headers.get("location")).toContain("/login");
    // The stale cookie must be cleared on THIS response — the one place a
    // page render's own clearStaleCookie attempt is silently swallowed.
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(AuthCookie);
    expect(setCookie.toLowerCase()).toMatch(/expires=thu, 01 jan 1970|max-age=0/);
  });

  test("a live account's cookie still authenticates normally", async () => {
    const { NextRequest } = await import("next/server");
    const protectedReq = new NextRequest(requestWithCookie("/", liveCookieValue));
    const protectedRes = await Middleware.middleware(protectedReq);
    expect(protectedRes.status).not.toBe(307);
    expect(protectedRes.headers.get("x-pathname")).toBe("/");

    const loginReq = new NextRequest(requestWithCookie("/login", liveCookieValue));
    const loginRes = await Middleware.middleware(loginReq);
    expect(loginRes.headers.get("location")).toContain("/");
  });
});
