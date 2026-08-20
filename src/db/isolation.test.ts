import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { DOMAIN_SLUGS } from "@/lib/domains";
import type { DefaultActivityInput, HabitEdit, HabitInput } from "./habits";
import type { UserId } from "./scope";

// Cross-user isolation, proven rather than remembered.
//
// The branded UserId in src/db/scope.ts makes a forgotten scope a compile
// error, which is worth a great deal — but it only guarantees that the right
// TYPE reached a query, never that the query used it. Two of the data modules
// (users.ts and the migration scripts) sit outside the brand entirely, by
// nature rather than by omission. This suite is what covers the gap: it asks,
// behaviourally, whether one signed-in account can reach another's rows.
//
// The adversary being modelled is not an anonymous attacker — it is a friend
// with a real session who edits an id in a URL. That is the realistic threat
// for an app with a closed set of accounts, and a scope bug hands it the keys.
//
// Needs a real Postgres, so it skips when DATABASE_URL is absent. It creates
// its own two accounts and deletes them again, so it is safe against a
// development database and must never be pointed at production.

const LIVE = Boolean(process.env.DATABASE_URL);

// src/db/index.ts builds its client at module scope and throws without a
// connection string, so importing any db module statically would crash this
// file before the skip above could take effect. The imports are therefore
// deferred into beforeAll, which does not run for a skipped suite. `typeof
// import(...)` is a type-position form and emits nothing at runtime, so the
// deferral costs no type safety.
let Index: typeof import("./index");
let Assess: typeof import("./assessment");
let Habits: typeof import("./habits");
let Queries: typeof import("./queries");
let RichHabits: typeof import("./rich-habits");
let Scope: typeof import("./scope");
let Users: typeof import("./users");

const DATE = "2026-03-02";
const OTHER_DATE = "2026-03-03";

// Unique per run, so a crashed run cannot collide with the next one.
const stamp = Date.now().toString(36);
const NAME_A = `iso-a-${stamp}`;
const NAME_B = `iso-b-${stamp}`;

function habit(name: string): HabitInput {
  return { name, domainSlug: "health", why: null };
}

const defaultActivity: DefaultActivityInput = {
  metricType: "count",
  unit: "pages",
  target: null,
  minimalAction: "one page",
};

// A complete grid, so sealAssessment has all twelve domains and actually
// freezes a priority cut. The action column differs per user so that reading
// the wrong assessment would be visible rather than coincidentally identical.
async function sealFor(userId: UserId, action: number): Promise<number> {
  const cycle = await Assess.getOrCreateCurrentCycle(userId, DATE);
  const draft = await Assess.getOrCreateDraft(userId, cycle.id, DATE);
  const domainIds = await Assess.getDomainIds();
  for (const slug of DOMAIN_SLUGS) {
    await Assess.saveRating(userId, draft.id, domainIds[slug], {
      possibility: 8,
      importanceNow: 9,
      importanceGeneral: 9,
      action,
      actionSatisfaction: 5,
      concern: 5,
    });
  }
  await Assess.sealAssessment(userId, draft.id);
  return cycle.id;
}

// Children before parents. Written out rather than leaning on ON DELETE
// CASCADE because the schema declares none, and a test that leaves rows behind
// in a shared database is worse than no test.
async function wipe(id: number): Promise<void> {
  const { db } = Index;
  await db.execute(sql`
    DELETE FROM assessment_ratings
     WHERE assessment_id IN (SELECT id FROM assessments WHERE user_id = ${id})`);
  for (const table of [
    "daily_checks",
    "activities",
    "ai_runs",
    "ai_pending_requests",
    "direction_narratives",
    "habits",
    "assessments",
    "cycles",
  ]) {
    await db.execute(sql`DELETE FROM ${sql.raw(table)} WHERE user_id = ${id}`);
  }
  await db.execute(sql`DELETE FROM users WHERE id = ${id}`);
}

describe.skipIf(!LIVE)("cross-user isolation", () => {
  let A: UserId;
  let B: UserId;
  let aHabit: number;
  let bHabit: number;
  let aActivity: number;
  let bActivity: number;
  let bProposalHabit: number;
  let bProposalActivity: number;
  let bCheck: number;
  let bCycle: number;
  let bRoutineActivity: number;

  beforeAll(async () => {
    [Index, Assess, Habits, Queries, RichHabits, Scope, Users] = await Promise.all([
      import("./index"),
      import("./assessment"),
      import("./habits"),
      import("./queries"),
      import("./rich-habits"),
      import("./scope"),
      import("./users"),
    ]);

    const idA = await Users.createUser(NAME_A);
    const idB = await Users.createUser(NAME_B);
    if (idA === null || idB === null) throw new Error("could not create users");
    A = Scope.scriptUserId(idA);
    B = Scope.scriptUserId(idB);

    await sealFor(A, 3);
    bCycle = await sealFor(B, 7);

    const domainIds = await Assess.getDomainIds();
    await Assess.upsertDirectionNarrative(B, bCycle, domainIds.health, {
      rawReflection: "B's private reflection",
      narrative: "B's private direction",
    });

    ({ habitId: aHabit, activityId: aActivity } = await Habits.createHabit(
      A,
      habit("A reads"),
      defaultActivity,
      { source: "human", activeFrom: DATE }
    ));
    ({ habitId: bHabit, activityId: bActivity } = await Habits.createHabit(
      B,
      habit("B reads"),
      defaultActivity,
      { source: "human", activeFrom: DATE }
    ));
    ({ habitId: bProposalHabit, activityId: bProposalActivity } = await Habits.createHabit(
      B,
      habit("B proposal"),
      defaultActivity,
      { source: "ai_suggested", activeFrom: null }
    ));

    // Materialises one daily_checks row per live activity per user.
    await Queries.getDayChecks(A, DATE);
    const bChecks = await Queries.getDayChecks(B, DATE);
    bCheck = bChecks[0].id;

    // A rich activity for B only — config-scoping has nothing to prove
    // without one account actually having a config the other could try to
    // reach.
    bRoutineActivity = await Habits.createActivity(
      B,
      bHabit,
      {
        name: "Rotina",
        metricType: "binary",
        unit: null,
        target: null,
        minimalAction: null,
        templateKind: "rotina",
        config: { blocks: [] },
      },
      { source: "human", why: null, activeFrom: DATE }
    );
    await RichHabits.saveRoutineBlocks(B, bRoutineActivity, [
      {
        startTime: "07:00",
        endTime: "08:00",
        activity: "B's secret block",
        weekdays: [1],
        position: 0,
      },
    ]);
  });

  afterAll(async () => {
    if (!LIVE) return;
    await wipe(A);
    await wipe(B);
  });

  // ─── Reads ─────────────────────────────────────────────────────────────────

  test("A's habit list contains none of B's", async () => {
    const mine = await Habits.listHabits(A, DATE);
    const ids = mine.map((h) => h.id);
    expect(ids).toContain(aHabit);
    expect(ids).not.toContain(bHabit);
    expect(mine.every((h) => h.name !== "B reads")).toBe(true);
  });

  test("A cannot fetch B's habit by id", async () => {
    expect(await Habits.getHabit(A, bHabit)).toBeNull();
    // Including the invisible one: a proposal is not a back door.
    expect(await Habits.getHabit(A, bProposalHabit)).toBeNull();
  });

  test("A cannot fetch B's activity by id", async () => {
    expect(await Habits.getActivity(A, bActivity)).toBeNull();
    expect(await Habits.getActivity(A, bProposalActivity)).toBeNull();
  });

  test("A's day shows only A's activities", async () => {
    const checks = await Queries.getDayChecks(A, DATE);
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.every((c) => c.activityId === aActivity)).toBe(true);
  });

  test("A's proposal list contains none of B's", async () => {
    const proposals = await Habits.listProposedHabits(A);
    expect(proposals.map((h) => h.id)).not.toContain(bProposalHabit);
  });

  test("A reads their own sealed assessment, not B's", async () => {
    const sealed = await Assess.getLatestSealed(A);
    expect(sealed).not.toBeNull();
    // A rated action 3 against importance 9; B rated 7. Reading B's would show
    // the wrong gap, and the gap is what the whole priority cut is built on.
    expect(sealed!.ratings.health?.action).toBe(3);
  });

  test("A cannot read B's directions, even holding B's cycle id", async () => {
    // A cycle id is a plain integer occupying a URL-shaped position elsewhere
    // in the app, so passing a foreign one is exactly the realistic attempt.
    const stolen = await Assess.listDirectionNarratives(A, bCycle);
    expect(Object.keys(stolen)).toHaveLength(0);
  });

  test("A's export carries nothing of B's", async () => {
    const data = await Queries.getExport(A, DATE, OTHER_DATE);
    const json = JSON.stringify(data);
    expect(json).not.toContain("B reads");
    expect(json).not.toContain("B proposal");
    expect(json).not.toContain("B's private direction");
    expect(json).not.toContain("B's secret block");
  });

  // ─── Id-addressed writes ───────────────────────────────────────────────────

  test("A cannot edit B's habit", async () => {
    // An edit carries only the fields the form shows — why is not among
    // them, by type. See HabitEdit in src/db/habits.ts.
    const edit: HabitEdit = { name: "stolen", domainSlug: "health" };
    const ok = await Habits.updateHabit(A, bHabit, edit);
    expect(ok).toBe(false);

    // And the row is genuinely untouched, not merely reported as unchanged.
    const still = await Habits.getHabit(B, bHabit);
    expect(still?.name).toBe("B reads");
  });

  test("A cannot remove B's habit", async () => {
    const ok = await Habits.removeHabit(A, bHabit, DATE);
    expect(ok).toBe(false);
    const still = await Habits.getHabit(B, bHabit);
    expect(still?.activeTo).toBeNull();
  });

  test("A cannot remove B's activity", async () => {
    const ok = await Habits.removeActivity(A, bActivity, DATE);
    expect(ok).toBe(false);
    const still = await Habits.getActivity(B, bActivity);
    expect(still?.activeTo).toBeNull();
  });

  test("A cannot toggle B's check", async () => {
    const result = await Queries.toggleCheck(A, bCheck, true);
    expect(result).toBeNull();
    const bChecks = await Queries.getDayChecks(B, DATE);
    expect(bChecks.find((c) => c.id === bCheck)?.done).toBe(false);
  });

  test("A starting tracking does not activate B's proposals", async () => {
    await Habits.activateProposedHabits(A, DATE);
    const stillProposed = await Habits.listProposedHabits(B);
    expect(stillProposed.map((h) => h.id)).toContain(bProposalHabit);
    expect((await Habits.getHabit(B, bProposalHabit))?.activeFrom).toBeNull();
  });

  // ─── The proposed/tracked split ────────────────────────────────────────────

  test("a proposal is invisible to every user-facing read", async () => {
    const { habitId: proposalHabit, activityId: proposalActivity } =
      await Habits.createHabit(A, habit("A proposal"), defaultActivity, {
        source: "ai_suggested",
        activeFrom: null,
      });

    expect((await Habits.listHabits(A, DATE)).map((h) => h.id)).not.toContain(
      proposalHabit
    );
    expect(
      (await Queries.getDayChecks(A, DATE)).map((c) => c.activityId)
    ).not.toContain(proposalActivity);
    expect(
      JSON.stringify(await Queries.getExport(A, DATE, OTHER_DATE))
    ).not.toContain("A proposal");

    // Visible only to the one read that asks for it by name.
    expect((await Habits.listProposedHabits(A)).map((h) => h.id)).toContain(
      proposalHabit
    );
  });

  // ─── Rich activity config ───────────────────────────────────────────────────
  //
  // The six rich domains used to be account-scoped by construction — a
  // dedicated table's own `user_id` column, then one habit's `config`. Now
  // they're one ACTIVITY's `config`, reached through getActivity(userId, id)
  // — scoped the same way every other read is, exercised here against a real
  // id belonging to the other account.

  test("A cannot reach B's routine activity by id", async () => {
    expect(await RichHabits.getRoutineConfig(A, bRoutineActivity)).toBeNull();
    expect(await RichHabits.listRoutineBlocks(A, bRoutineActivity)).toEqual([]);
  });

  test("A's Day Audit lookups carry none of B's block names", async () => {
    const lookups = await Queries.getAuditLookups(A);
    expect(JSON.stringify(lookups)).not.toContain("B's secret block");
  });
});
