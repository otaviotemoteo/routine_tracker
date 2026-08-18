// The actual "is this session real" question, factored out of session.ts on
// its own — deliberately WITHOUT `import "server-only"`, even though this
// touches a secret (AUTH_SECRET) and the database. Two reasons, the same
// shape as auth.ts's own choice to skip the guard:
//
//   1. Nothing routes untrusted input into this function directly — it is
//      only ever called from session.ts (still server-only-guarded) and from
//      src/lib/session-resolve.test.ts. The guard is a convenience net
//      against an accidental client import, not the only thing standing
//      between this and a browser bundle.
//   2. `import "server-only"` throws unconditionally outside Next's own
//      bundler (its real implementation is `throw new Error(...)`, swapped
//      for a no-op only by Next's webpack/turbopack config) — so a file that
//      has it can never be imported by a plain `bun test`. Splitting the one
//      function that needs to be tested directly, out of the one that needs
//      to be guarded, is what lets both be true at once.
//
// A cookie's signature and age (readAuthCookieValue, src/lib/auth.ts) say who
// it CLAIMS to be and for how long that claim is allowed to stand — neither
// says the account still exists. The same "derive it from the database, not
// a trusted flag" rule the onboarding gate runs on (src/lib/onboarding-flow.ts),
// one layer earlier: identity itself is derived from a live row, not just a
// signature that once matched one. A year-long cookie for a deleted account
// (a stale browser session surviving an account cleanup, say) would otherwise
// keep resolving to a UserId every downstream write assumes is real, until
// the first foreign-key constraint it touches throws.
import { readAuthCookieValue } from "@/lib/auth";
import { asUserId, type UserId } from "@/db/scope";
import { userExists } from "@/db/users";

export async function resolveSessionUserId(
  cookieValue: string | undefined
): Promise<UserId | null> {
  const userId = await readAuthCookieValue(
    cookieValue,
    process.env.AUTH_SECRET ?? ""
  );
  if (userId === null) return null;
  if (!(await userExists(userId))) return null;
  return asUserId(userId);
}
