import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { DOMAIN_SLUGS } from "@/lib/domains";
import { PLAIN_KIND } from "@/lib/templates";
import type { HabitEdit, HabitInput } from "./habits";
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
let Scope: typeof import("./scope");
let Users: typeof import("./users");

const DATE = "2026-03-02";
const OTHER_DATE = "2026-03-03";

// Unique per run, so a crashed run cannot collide with the next one.
const stamp = Date.now().toString(36);
const NAME_A = `iso-a-${stamp}`;
const NAME_B = `iso-b-${stamp}`;

function habit(name: string): HabitInput {
  return {
    name,
    domainSlug: "health",
    metricType: "count",
    unit: "pages",
    target: null,
    minimalAction: "one page",
    templateKind: PLAIN_KIND,
    why: null,
  };
}

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
  await db.execute(sql`
    DELETE FROM workout_plan_days
     WHERE plan_id IN (SELECT id FROM workout_plans WHERE user_id = ${id})`);
  for (const table of [
    "daily_checks",
    "ai_runs",
    "ai_pending_requests",
    "direction_narratives",
    "habits",
    "assessments",
    "cycles",
    "workout_plans",
    "books",
    "reading_goals",
    "routine_blocks",
    "spiritual_practices",
    "languages",
    "sleep_targets",
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
  let bProposal: number;
  let bCheck: number;
  let bCycle: number;

  beforeAll(async () => {
    [Index, Assess, Habits, Queries, Scope, Users] = await Promise.all([
      import("./index"),
      import("./assessment"),
      import("./habits"),
      import("./queries"),
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

    aHabit = await Habits.createHabit(A, habit("A reads"), {
      source: "human",
      activeFrom: DATE,
    });
    bHabit = await Habits.createHabit(B, habit("B reads"), {
      source: "human",
      activeFrom: DATE,
    });
    bProposal = await Habits.createHabit(B, habit("B proposal"), {
      source: "ai_suggested",
      activeFrom: null,
    });

    // Materialises one daily_checks row per live habit per user.
    await Queries.getDayChecks(A, DATE);
    const bChecks = await Queries.getDayChecks(B, DATE);
    bCheck = bChecks[0].id;
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
    expect(await Habits.getHabit(A, bProposal)).toBeNull();
  });

  test("A's day shows only A's habits", async () => {
    const checks = await Queries.getDayChecks(A, DATE);
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.every((c) => c.habitId === aHabit)).toBe(true);
  });

  test("A's proposal list contains none of B's", async () => {
    const proposals = await Habits.listProposedHabits(A);
    expect(proposals.map((h) => h.id)).not.toContain(bProposal);
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
  });

  // ─── Id-addressed writes ───────────────────────────────────────────────────

  test("A cannot edit B's habit", async () => {
    // An edit carries only the fields the form shows — template_kind and why
    // are not among them, by type. See HabitEdit in src/db/habits.ts.
    const { templateKind: _t, why: _w, ...edit } = habit("stolen");
    const ok = await Habits.updateHabit(A, bHabit, edit as HabitEdit);
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

  test("A cannot toggle B's check", async () => {
    const result = await Queries.toggleCheck(A, bCheck, true);
    expect(result).toBeNull();
    const bChecks = await Queries.getDayChecks(B, DATE);
    expect(bChecks.find((c) => c.id === bCheck)?.done).toBe(false);
  });

  test("A starting tracking does not activate B's proposals", async () => {
    await Habits.activateProposedHabits(A, DATE);
    const stillProposed = await Habits.listProposedHabits(B);
    expect(stillProposed.map((h) => h.id)).toContain(bProposal);
    expect((await Habits.getHabit(B, bProposal))?.activeFrom).toBeNull();
  });

  // ─── The proposed/tracked split ────────────────────────────────────────────

  test("a proposal is invisible to every user-facing read", async () => {
    const proposal = await Habits.createHabit(A, habit("A proposal"), {
      source: "ai_suggested",
      activeFrom: null,
    });

    expect((await Habits.listHabits(A, DATE)).map((h) => h.id)).not.toContain(
      proposal
    );
    expect(
      (await Queries.getDayChecks(A, DATE)).map((c) => c.habitId)
    ).not.toContain(proposal);
    expect(
      JSON.stringify(await Queries.getExport(A, DATE, OTHER_DATE))
    ).not.toContain("A proposal");

    // Visible only to the one read that asks for it by name.
    expect((await Habits.listProposedHabits(A)).map((h) => h.id)).toContain(
      proposal
    );
  });
});
