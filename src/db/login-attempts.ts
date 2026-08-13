// The durable login limiter's data access.
//
// The one module under src/db that takes no UserId, branded or otherwise, and
// that is not an oversight: login happens BEFORE a session exists. The handle
// someone types is a claim, not an identity, and pretending otherwise by
// branding it would be a lie about when the value was authenticated. The same
// reasoning applies to src/db/users.ts — see the table in src/db/scope.ts.
//
// It replaces src/lib/rate-limit.ts, which kept its counters in a Map. On a
// serverless deployment that Map lives per instance and dies with it, so a
// cold start reset the limit — which means the limit was, in practice, "five
// attempts per instance", and instances are cheap for an attacker to get.
import { and, eq, lt, or, sql } from "drizzle-orm";
import { db } from "./index";
import { loginAttempts, type AttemptKeyKind } from "./schema";

// The sliding window. A failure older than this stops counting.
export const WINDOW_MINUTES = 15;

export interface AttemptState {
  failures: number;
  // Minutes until the window rolls over, for the "try again in n minutes"
  // message. Zero when nothing is being counted.
  retryAfterMinutes: number;
}

function windowStart(): Date {
  return new Date(Date.now() - WINDOW_MINUTES * 60_000);
}

// How many failures are currently counted against this key.
//
// The window is applied in the WHERE clause rather than by deleting expired
// rows first: a read must not depend on a write having happened, and a stale
// row costs nothing until something asks about it.
export async function countFailures(
  kind: AttemptKeyKind,
  value: string
): Promise<AttemptState> {
  const [row] = await db
    .select({
      failures: loginAttempts.failures,
      windowStart: loginAttempts.windowStart,
    })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.keyKind, kind),
        eq(loginAttempts.keyValue, value),
        sql`${loginAttempts.windowStart} >= ${windowStart()}`
      )
    );
  if (!row) return { failures: 0, retryAfterMinutes: 0 };

  const endsAt = row.windowStart.getTime() + WINDOW_MINUTES * 60_000;
  return {
    failures: row.failures,
    retryAfterMinutes: Math.max(1, Math.ceil((endsAt - Date.now()) / 60_000)),
  };
}

// Count one failure.
//
// A single upsert, so two requests racing cannot both read 4 and both write 5.
// The window resets inside the same statement when the stored one has expired,
// which is what keeps this from needing a read first.
export async function recordFailure(
  kind: AttemptKeyKind,
  value: string
): Promise<void> {
  const cutoff = windowStart();
  await db
    .insert(loginAttempts)
    .values({ keyKind: kind, keyValue: value, failures: 1 })
    .onConflictDoUpdate({
      target: [loginAttempts.keyKind, loginAttempts.keyValue],
      set: {
        failures: sql`CASE WHEN ${loginAttempts.windowStart} < ${cutoff}
                           THEN 1 ELSE ${loginAttempts.failures} + 1 END`,
        windowStart: sql`CASE WHEN ${loginAttempts.windowStart} < ${cutoff}
                              THEN now() ELSE ${loginAttempts.windowStart} END`,
        updatedAt: sql`now()`,
      },
    });
}

// A correct password clears the slate for that key. Only ever called for the
// IP and the handle that just succeeded, so one person signing in cannot
// reset a counter that is tracking somebody else.
export async function clearFailures(
  kind: AttemptKeyKind,
  value: string
): Promise<void> {
  await db
    .delete(loginAttempts)
    .where(
      and(eq(loginAttempts.keyKind, kind), eq(loginAttempts.keyValue, value))
    );
}

// Housekeeping. Rows outside every window are dead weight; this is called on
// the success path, where there is already a write and nobody is waiting on a
// few milliseconds.
export async function pruneExpiredAttempts(): Promise<void> {
  await db
    .delete(loginAttempts)
    .where(
      or(
        lt(loginAttempts.windowStart, windowStart()),
        // Defensive: a row with a future window_start would otherwise never
        // expire. Only reachable through a clock change, but a limiter that
        // can be made permanent by one is not a limiter.
        sql`${loginAttempts.windowStart} > now() + interval '1 day'`
      )
    );
}
