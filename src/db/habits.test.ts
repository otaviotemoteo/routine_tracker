import { afterAll, beforeAll, describe, expect, test } from "bun:test";

// Decision 3 (docs/HABIT-VS-ACTIVITY-MODEL.md): generating an activity
// always INSERTS a new row, never updates an existing one. Two activities
// that both end up wanting the same rich kind must never be able to
// silently share — let alone overwrite — one another's config. This used to
// be promoteToRichKind's own guarantee (proven against getOrCreateSingletonHabit's
// "reuse the one habit of this kind" failure mode); both of those are gone
// now that createActivity always inserts, so this proves the same guarantee
// holds at the layer that replaced them, against a real database.
//
// Also covers the default-activity invariant's other half: acceptProposedActivities'
// placeholder-retirement guard — a habit's still-untouched default (plain)
// activity is retired the first time a real activity is accepted for it,
// but only when it has no logged history of its own.
//
// Needs a real Postgres, so it skips when DATABASE_URL is absent — same
// convention as src/db/isolation.test.ts. Creates and deletes its own
// throwaway account and habits.

const LIVE = Boolean(process.env.DATABASE_URL);

let Habits: typeof import("./habits");
let Index: typeof import("./index");
let Schema: typeof import("./schema");
let Scope: typeof import("./scope");

const stamp = Date.now().toString(36);
const NAME = `habits-activities-test-${stamp}`;
const DATE = "2026-03-02";

describe.skipIf(!LIVE)("activities", () => {
  let userId: import("./scope").UserId;

  beforeAll(async () => {
    [Habits, Index, Schema, Scope] = await Promise.all([
      import("./habits"),
      import("./index"),
      import("./schema"),
      import("./scope"),
    ]);
    const created = await import("./users").then((m) => m.createUser(NAME));
    if (created === null) throw new Error("could not create user");
    userId = Scope.scriptUserId(created);
  });

  afterAll(async () => {
    if (!LIVE) return;
    // Children before parent — activities.user_id and habits.user_id have no
    // ON DELETE CASCADE (deliberately, per src/db/schema.ts: a row is never
    // destroyed out from under a daily_checks reference), so the user
    // delete fails until every row this test created is gone first.
    const { eq } = await import("drizzle-orm");
    await Index.db.delete(Schema.dailyChecks).where(eq(Schema.dailyChecks.userId, userId));
    await Index.db.delete(Schema.activities).where(eq(Schema.activities.userId, userId));
    await Index.db.delete(Schema.habits).where(eq(Schema.habits.userId, userId));
    await Index.db.delete(Schema.users).where(eq(Schema.users.id, userId));
  });

  test("two activities promoted to the same kind, under different habits, keep independent configs", async () => {
    const { habitId: habitA } = await Habits.createHabit(
      userId,
      { name: "Força", domainSlug: "health", why: "Ficar mais forte" },
      { metricType: "binary", unit: null, target: null, minimalAction: "5 minutos" },
      { source: "human", activeFrom: DATE }
    );
    const { habitId: habitB } = await Habits.createHabit(
      userId,
      { name: "Corrida", domainSlug: "health", why: "Correr mais" },
      { metricType: "binary", unit: null, target: null, minimalAction: "5 minutos" },
      { source: "human", activeFrom: DATE }
    );

    const configA = { planName: "Plano de força", days: [{ id: 1, weekday: 1, focus: "Peito", exercises: [{ name: "Supino" }], active: true }] };
    const configB = { planName: "Plano de corrida", days: [{ id: 1, weekday: 2, focus: "Corrida leve", exercises: [{ name: "Corrida" }], active: true }] };

    const activityA = await Habits.createActivity(
      userId,
      habitA,
      { name: "Treino", metricType: "binary", unit: null, target: null, minimalAction: null, templateKind: "treino", config: configA },
      { source: "human", why: null, activeFrom: DATE }
    );
    const activityB = await Habits.createActivity(
      userId,
      habitB,
      { name: "Treino", metricType: "binary", unit: null, target: null, minimalAction: null, templateKind: "treino", config: configB },
      { source: "human", why: null, activeFrom: DATE }
    );

    const rowA = await Habits.getActivity(userId, activityA);
    const rowB = await Habits.getActivity(userId, activityB);
    expect(rowA?.templateKind).toBe("treino");
    expect(rowB?.templateKind).toBe("treino");
    // The real assertion: creating B never touched A's row — the exact
    // failure mode a singleton-style "the account's one treino" lookup
    // would have caused here.
    expect((rowA?.config as typeof configA).planName).toBe("Plano de força");
    expect((rowB?.config as typeof configB).planName).toBe("Plano de corrida");

    // And both are independently reachable — there is no more "oldest
    // wins" resolution to collapse them: each is addressed by its own id.
    expect(rowA?.id).not.toBe(rowB?.id);
    expect(rowA?.habitId).toBe(habitA);
    expect(rowB?.habitId).toBe(habitB);
  });

  test("accepting a real activity retires its habit's untouched default, but keeps one with logged history", async () => {
    // Habit 1: default activity never checked — should be retired once a
    // real activity is accepted alongside it.
    const { habitId: habit1, activityId: default1 } = await Habits.createHabit(
      userId,
      { name: "Comunicação", domainSlug: "family", why: null },
      { metricType: "binary", unit: null, target: null, minimalAction: null },
      { source: "human", activeFrom: DATE }
    );
    const proposed1 = await Habits.createActivity(
      userId,
      habit1,
      { name: "Ligar para a família", metricType: "binary", unit: null, target: null, minimalAction: null, templateKind: null, config: null },
      { source: "ai_suggested", why: "briefing", activeFrom: null }
    );

    // Habit 2: default activity HAS logged history — must survive.
    const { habitId: habit2, activityId: default2 } = await Habits.createHabit(
      userId,
      { name: "Leitura", domainSlug: "education", why: null },
      { metricType: "binary", unit: null, target: null, minimalAction: null },
      { source: "human", activeFrom: DATE }
    );
    const { eq, and } = await import("drizzle-orm");
    await Index.db.insert(Schema.dailyChecks).values({
      userId,
      activityId: default2,
      checkedAt: DATE,
      done: true,
    });
    const proposed2 = await Habits.createActivity(
      userId,
      habit2,
      { name: "Treino", metricType: "binary", unit: null, target: null, minimalAction: null, templateKind: "treino", config: { planName: "", days: [] } },
      { source: "ai_suggested", why: "briefing", activeFrom: null }
    );

    const accepted = await Habits.acceptProposedActivities(userId, DATE);
    expect(accepted).toBe(2);

    const [retired] = await Index.db
      .select({ activeTo: Schema.activities.activeTo })
      .from(Schema.activities)
      .where(and(eq(Schema.activities.id, default1), eq(Schema.activities.userId, userId)));
    expect(retired?.activeTo).toBe(DATE);

    const [survived] = await Index.db
      .select({ activeTo: Schema.activities.activeTo })
      .from(Schema.activities)
      .where(and(eq(Schema.activities.id, default2), eq(Schema.activities.userId, userId)));
    expect(survived?.activeTo).toBeNull();

    const acceptedA = await Habits.getActivity(userId, proposed1);
    const acceptedB = await Habits.getActivity(userId, proposed2);
    expect(acceptedA?.activeFrom).toBe(DATE);
    expect(acceptedB?.activeFrom).toBe(DATE);
  });
});
