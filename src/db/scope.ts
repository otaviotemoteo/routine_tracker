// Ownership, enforced by the compiler rather than by remembering.
//
// The remodel made `habits` per-user, and a forgotten `user_id` on one of its
// reads would leak somebody's habits — and, through the area each one is
// anchored to, a shadow of their sealed values assessment. That is the most
// intimate record this app holds, so the scope should not be a thing a
// developer has to remember at each call site.
//
// Two mechanisms, both cheap:
//
//   UserId       a branded number. Only src/lib/session.ts can mint one, out
//                of a verified cookie. A raw `number` off a route param or a
//                request body no longer typechecks as a user id, so passing
//                the wrong integer is a compile error rather than a leak.
//
//   habitsFor()  the ONE predicate for reading a user's habits. Nothing else
//                should write `eq(habits.userId, …)` by hand, because the
//                filter has a second half that is easy to forget: a proposed
//                habit (active_from IS NULL) must stay invisible everywhere.
//
// WHAT THE BRAND COVERS, stated so the guarantee is honest:
//
//   branded       queries.ts · habits.ts · assessment.ts · ai.ts
//   manual audit  users.ts — genuinely pre-auth. findUserByName runs BEFORE a
//                 session exists, and claimAccount/changePassword take an id
//                 that is pre-session or script-only. Branding it would be a
//                 lie about when the value was authenticated.
//   manual audit  migrate-*.ts, seed*.ts — pg over TCP, no session, operator
//                 run. Covered behaviourally by src/db/isolation.test.ts.
import { and, eq, isNotNull, isNull, or, gte, lte, sql } from "drizzle-orm";
import { activities, habits } from "./schema";

declare const brand: unique symbol;

// A user id that came from a verified session. Mint it only in session.ts.
export type UserId = number & { readonly [brand]: "UserId" };

// The single sanctioned way to turn a verified integer into a UserId. Named so
// that `grep asUserId` finds every place authentication is being asserted —
// there should be exactly three (requireUserId, getUserId, and the test
// helper), and any fourth deserves a hard look.
export function asUserId(id: number): UserId {
  return id as UserId;
}

// Scripts run without a session (they are the operator, acting on an account
// they named on the command line). This says that out loud rather than letting
// a bare cast hide in the middle of a migration.
export function scriptUserId(id: number): UserId {
  return id as UserId;
}

// Every user-facing read of `habits` goes through this.
//
// The second half is the one that gets forgotten: `active_from IS NULL` means
// PROPOSED — a suggestion written to the database so a slow generation
// survives a refresh, but which must not appear on Today, in the week grid,
// in the month view, in the daily flow, in a streak, or in the export until
// the user presses "Start tracking". Keeping that condition here means no
// caller can omit it.
export function habitsFor(userId: UserId, onDate?: string) {
  return and(
    eq(habits.userId, userId),
    isNotNull(habits.activeFrom),
    // A habit only applies to days inside its own window. Without this,
    // getDayChecks would keep materialising checks for a removed habit
    // forever, and past days would gain rows for habits that did not exist yet.
    onDate ? lte(habits.activeFrom, onDate) : undefined,
    onDate
      ? or(isNull(habits.activeTo), gte(habits.activeTo, onDate))
      : undefined
  );
}

// Habits that overlap a date range at all — the week grid and the month view
// ask "which habits were live at any point in this period?", which is not the
// same question as habitsFor(date) asked seven or thirty times.
export function habitsForRange(userId: UserId, from: string, to: string) {
  return and(
    eq(habits.userId, userId),
    isNotNull(habits.activeFrom),
    lte(habits.activeFrom, to),
    or(isNull(habits.activeTo), gte(habits.activeTo, from))
  );
}

// The complement: the proposed set, which only the review screen may read.
// Separate from habitsFor by design — a caller has to ask for these by name.
export function proposedHabitsFor(userId: UserId) {
  return and(eq(habits.userId, userId), isNull(habits.activeFrom));
}

// Every user-facing read of `activities` goes through this — the same rule
// habitsFor() enforces one layer up, see docs/ARCHITECTURE.md.
// One extra guard beyond mirroring habitsFor(): an activity's own
// active_from IS NOT NULL is necessary but not sufficient — its PARENT
// HABIT must also be live on the date, so a bug in removeHabit's archive
// fan-out (below) can't resurrect a card whose habit was actually removed.
// Requires `activities` joined to `habits` in the query this is used in.
export function activitiesFor(userId: UserId, onDate?: string) {
  return and(
    eq(activities.userId, userId),
    isNotNull(activities.activeFrom),
    onDate ? lte(activities.activeFrom, onDate) : undefined,
    onDate
      ? or(isNull(activities.activeTo), gte(activities.activeTo, onDate))
      : undefined,
    isNotNull(habits.activeFrom),
    onDate ? lte(habits.activeFrom, onDate) : undefined,
    onDate ? or(isNull(habits.activeTo), gte(habits.activeTo, onDate)) : undefined
  );
}

// Activities that overlap a date range at all — mirrors habitsForRange(),
// for the week grid and month view.
export function activitiesForRange(userId: UserId, from: string, to: string) {
  return and(
    eq(activities.userId, userId),
    isNotNull(activities.activeFrom),
    lte(activities.activeFrom, to),
    or(isNull(activities.activeTo), gte(activities.activeTo, from)),
    isNotNull(habits.activeFrom),
    lte(habits.activeFrom, to),
    or(isNull(habits.activeTo), gte(habits.activeTo, from))
  );
}

// The complement: an account's proposed activities, optionally narrowed to
// one habit's own — only the activities review screen reads these.
export function proposedActivitiesFor(userId: UserId, habitId?: number) {
  return and(
    eq(activities.userId, userId),
    isNull(activities.activeFrom),
    habitId !== undefined ? eq(activities.habitId, habitId) : undefined
  );
}

// Whether a habit row was live on a given day, for callers that already hold
// the row (the export, the day audit) and would otherwise re-query.
export function wasActiveOn(
  habit: { activeFrom: string | null; activeTo: string | null },
  date: string
): boolean {
  if (habit.activeFrom === null) return false;
  if (date < habit.activeFrom) return false;
  return habit.activeTo === null || date <= habit.activeTo;
}

// Used by the migration's verification query and by the isolation test.
export const ANY_ACTIVE = sql`active_from IS NOT NULL`;
