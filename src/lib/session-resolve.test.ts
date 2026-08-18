import { afterAll, beforeAll, describe, expect, test } from "bun:test";

// resolveSessionUserId against a real database — the exact regression this
// covers: a signed cookie whose signature and age both check out, minted for
// an account that no longer exists (a stale browser session surviving an
// account cleanup, the case that produced a `cycles_user_id_fkey` crash on
// /onboarding). Before this fix, only the signature/age were ever checked;
// this asserts the existence check actually runs.
//
// Needs a real Postgres, so it skips when DATABASE_URL is absent — same
// convention as src/db/isolation.test.ts. Creates and deletes its own
// throwaway account.

const LIVE = Boolean(process.env.DATABASE_URL) && Boolean(process.env.AUTH_SECRET);

let Resolve: typeof import("./session-resolve");
let Auth: typeof import("./auth");
let Index: typeof import("../db/index");
let Users: typeof import("../db/users");
let Schema: typeof import("../db/schema");
let Scope: typeof import("../db/scope");

const stamp = Date.now().toString(36);
const NAME = `session-test-${stamp}`;

describe.skipIf(!LIVE)("resolveSessionUserId", () => {
  let id: number;

  beforeAll(async () => {
    [Resolve, Auth, Index, Users, Schema, Scope] = await Promise.all([
      import("./session-resolve"),
      import("./auth"),
      import("../db/index"),
      import("../db/users"),
      import("../db/schema"),
      import("../db/scope"),
    ]);
    const created = await Users.createUser(NAME);
    if (created === null) throw new Error("could not create user");
    id = created;
  });

  afterAll(async () => {
    if (!LIVE) return;
    const { eq } = await import("drizzle-orm");
    await Index.db.delete(Schema.users).where(eq(Schema.users.id, id));
  });

  test("a valid cookie for an existing account still resolves", async () => {
    const cookieValue = await Auth.createAuthCookieValue(
      id,
      process.env.AUTH_SECRET ?? ""
    );
    expect(await Resolve.resolveSessionUserId(cookieValue)).toBe(
      Scope.scriptUserId(id)
    );
  });

  test("a validly-signed cookie for a DELETED account resolves to null, not a crash", async () => {
    const cookieValue = await Auth.createAuthCookieValue(
      id,
      process.env.AUTH_SECRET ?? ""
    );
    // Confirm the cookie is good before deleting the account — otherwise a
    // null result here would prove nothing about the existence check.
    expect(await Resolve.resolveSessionUserId(cookieValue)).toBe(
      Scope.scriptUserId(id)
    );

    const { eq } = await import("drizzle-orm");
    await Index.db.delete(Schema.users).where(eq(Schema.users.id, id));

    expect(await Resolve.resolveSessionUserId(cookieValue)).toBeNull();

    // Re-create it under the same id's neighborhood isn't guaranteed (serial
    // pk), so afterAll's cleanup re-derives a fresh id instead of relying on
    // this one still existing.
    const recreated = await Users.createUser(NAME);
    if (recreated !== null) id = recreated;
  });

  test("a tampered cookie (bad signature) resolves to null", async () => {
    const cookieValue = await Auth.createAuthCookieValue(
      id,
      process.env.AUTH_SECRET ?? ""
    );
    const tampered = `${cookieValue.slice(0, -4)}0000`;
    expect(await Resolve.resolveSessionUserId(tampered)).toBeNull();
  });
});
