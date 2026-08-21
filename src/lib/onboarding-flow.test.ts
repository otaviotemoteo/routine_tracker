import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { DOMAIN_SLUGS } from "./domains";
import type { UserId } from "@/db/scope";

// Covers the two regressions this resolver exists to prevent — see
// src/lib/onboarding-flow.ts and docs/ARCHITECTURE.md's onboarding section.
// Neither is visually obvious in a manual walkthrough, and both are cheap to
// silently re-break in a future refactor of this exact function.
//
// Needs a real Postgres, so it skips when DATABASE_URL is absent. Follows
// src/db/isolation.test.ts's pattern exactly: deferred imports (importing any
// db module statically would crash this file before the skip could take
// effect), a stamped unique account per run, full cleanup in afterAll.

const LIVE = Boolean(process.env.DATABASE_URL);

let Index: typeof import("@/db/index");
let Assess: typeof import("@/db/assessment");
let Habits: typeof import("@/db/habits");
let Scope: typeof import("@/db/scope");
let Users: typeof import("@/db/users");
let Flow: typeof import("./onboarding-flow");

const DATE = "2026-03-02";
const stamp = Date.now().toString(36);

// A complete, sealed grid. `action` controls whether domains clear the
// priority cut: low action against a high importanceGeneral produces a real
// gap (real priority domains); a low importanceGeneral produces none at all,
// regardless of action, since eligibility is importanceGeneral > 4.
async function sealFor(
  userId: UserId,
  importanceGeneral: number,
  action: number
): Promise<{ cycleId: number; draftId: number }> {
  const cycle = await Assess.getOrCreateCurrentCycle(userId, DATE);
  const draft = await Assess.getOrCreateDraft(userId, cycle.id, DATE);
  const domainIds = await Assess.getDomainIds();
  for (const slug of DOMAIN_SLUGS) {
    await Assess.saveRating(userId, draft.id, domainIds[slug], {
      possibility: 8,
      importanceNow: 9,
      importanceGeneral,
      action,
      actionSatisfaction: 5,
      concern: 5,
    });
  }
  await Assess.sealAssessment(userId, draft.id);
  return { cycleId: cycle.id, draftId: draft.id };
}

async function wipe(id: number): Promise<void> {
  const { db } = Index;
  await db.execute(sql`
    DELETE FROM assessment_ratings
     WHERE assessment_id IN (SELECT id FROM assessments WHERE user_id = ${id})`);
  // daily_checks/activities before habits — every tracked habit gets a
  // default activity now (docs/ARCHITECTURE.md's "default-activity
  // invariant"), and activities_habit_id_fkey rejects deleting a habit one
  // still references.
  for (const table of [
    "daily_checks",
    "activities",
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

describe.skipIf(!LIVE)("resolveOnboardingStep", () => {
  let rawId: number;
  let userId: UserId;

  beforeAll(async () => {
    [Index, Assess, Habits, Scope, Users, Flow] = await Promise.all([
      import("@/db/index"),
      import("@/db/assessment"),
      import("@/db/habits"),
      import("@/db/scope"),
      import("@/db/users"),
      import("./onboarding-flow"),
    ]);
    const id = await Users.createUser(`onb-flow-${stamp}`);
    if (id === null) throw new Error("could not create user");
    rawId = id;
    userId = Scope.scriptUserId(id);
  });

  afterAll(async () => {
    await wipe(rawId);
  });

  test("nothing sealed, no open draft -> intro", async () => {
    expect(await Flow.resolveOnboardingStep(userId)).toEqual({ screen: "intro" });
  });

  test(
    // The critical-bug regression: habits proposed by the AI (active_from
    // NULL) but "Start tracking" never pressed must resolve to the review
    // screen, not collapse back into "nothing done yet".
    "habits proposed but not started -> habits",
    async () => {
      const { cycleId } = await sealFor(userId, 9, 3);
      const domainIds = await Assess.getDomainIds();
      // The first PRIORITY_CUT (5) domains in DOMAIN_SLUGS order all tie on
      // gap when every rating is identical, so this is deterministic.
      for (const slug of DOMAIN_SLUGS.slice(0, 5)) {
        await Assess.upsertDirectionNarrative(userId, cycleId, domainIds[slug], {
          rawReflection: "reflecting",
          narrative: "a direction",
        });
      }
      await Habits.createHabit(
        userId,
        { name: "Proposed habit", domainSlug: null, why: "generated" },
        { metricType: "binary", unit: null, target: null, minimalAction: "one step" },
        { source: "ai_suggested", activeFrom: null }
      );

      expect(await Flow.resolveOnboardingStep(userId)).toEqual({ screen: "habits" });
    }
  );

  test(
    // P4's regression: a fresh seal with real priority domains and NOTHING
    // written yet must land on results, not jump straight to directions.
    // Before this fix the resolver had no branch for "sealed, zero
    // directions" at all, so the very first redirect after sealing skipped
    // results entirely.
    "sealed, zero directions written -> results, not directions",
    async () => {
      await wipeAssessmentsOnly(rawId);
      await sealFor(userId, 9, 3);
      expect(await Flow.resolveOnboardingStep(userId)).toEqual({ screen: "results" });
    }
  );

  test(
    // The dead-end regression: every domain's importance came in too low to
    // clear the priority cut. Nothing downstream (directions, areas) has
    // anything to do with an empty list, so this must not resolve to the
    // results screen (which has no forward button in that state) or to
    // directions/areas (which would just bounce back).
    "sealed with zero priority domains -> habits, not a dead end",
    async () => {
      await wipeAssessmentsOnly(rawId);
      await sealFor(userId, 3, 3);
      expect(await Flow.resolveOnboardingStep(userId)).toEqual({ screen: "habits" });
    }
  );
});

// Between the later tests, only the assessment/cycle/habit state needs
// resetting (not the user itself) — re-sealing while a previous sealed row
// exists is exactly the "second sealed assessment in the same cycle" shape
// the critical bug used to produce, and getLatestSealed's newest-wins
// ordering means the fresh one is what the resolver reads either way, so
// this keeps each test independent without needing a second account.
// activities before habits, same FK reason as wipe() above — any test that
// created a habit left it a default activity.
async function wipeAssessmentsOnly(id: number): Promise<void> {
  const { db } = Index;
  await db.execute(sql`
    DELETE FROM assessment_ratings
     WHERE assessment_id IN (SELECT id FROM assessments WHERE user_id = ${id})`);
  for (const table of [
    "daily_checks",
    "activities",
    "direction_narratives",
    "habits",
    "assessments",
    "cycles",
  ]) {
    await db.execute(sql`DELETE FROM ${sql.raw(table)} WHERE user_id = ${id}`);
  }
}
