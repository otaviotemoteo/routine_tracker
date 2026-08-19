import { afterAll, beforeAll, describe, expect, test } from "bun:test";

// promoteToRichKind's whole reason for existing (HABIT-VS-ACTIVITY-MODEL.md
// decision 3): two habits that both end up wanting the same rich kind must
// never be able to silently share — let alone overwrite — one another's
// config. getOrCreateSingletonHabit's "reuse the one habit of this kind"
// behavior is exactly right for /config; promoteToRichKind is the path that
// must NOT do that. This proves it against a real database rather than
// trusting the WHERE clause reads correctly.
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
const NAME = `habits-promote-test-${stamp}`;
const DATE = "2026-03-02";

describe.skipIf(!LIVE)("promoteToRichKind", () => {
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
    // Children before parent — habits.user_id has no ON DELETE CASCADE
    // (deliberately, per src/db/schema.ts: a row is never destroyed out from
    // under a daily_checks reference), so the user delete fails until every
    // habit this test created is gone first.
    const { eq } = await import("drizzle-orm");
    await Index.db.delete(Schema.habits).where(eq(Schema.habits.userId, userId));
    await Index.db.delete(Schema.users).where(eq(Schema.users.id, userId));
  });

  test("two habits promoted to the same kind keep independent configs", async () => {
    const habitA = await Habits.createHabit(
      userId,
      {
        name: "Força",
        domainSlug: "health",
        metricType: "binary",
        unit: null,
        target: null,
        minimalAction: "5 minutos",
        templateKind: "plain",
        why: "Ficar mais forte",
      },
      { source: "human", activeFrom: DATE }
    );
    const habitB = await Habits.createHabit(
      userId,
      {
        name: "Corrida",
        domainSlug: "health",
        metricType: "binary",
        unit: null,
        target: null,
        minimalAction: "5 minutos",
        templateKind: "plain",
        why: "Correr mais",
      },
      { source: "human", activeFrom: DATE }
    );

    const configA = { planName: "Plano de força", days: [{ id: 1, weekday: 1, focus: "Peito", exercises: [{ name: "Supino" }], active: true }] };
    const configB = { planName: "Plano de corrida", days: [{ id: 1, weekday: 2, focus: "Corrida leve", exercises: [{ name: "Corrida" }], active: true }] };

    const okA = await Habits.promoteToRichKind(userId, habitA, "treino", configA);
    const okB = await Habits.promoteToRichKind(userId, habitB, "treino", configB);
    expect(okA).toBe(true);
    expect(okB).toBe(true);

    const rowA = await Habits.getHabit(userId, habitA);
    const rowB = await Habits.getHabit(userId, habitB);
    expect(rowA?.templateKind).toBe("treino");
    expect(rowB?.templateKind).toBe("treino");
    // The real assertion: B's promotion did not overwrite A's config (the
    // exact failure mode getOrCreateSingletonHabit would have caused here —
    // it would have resolved both calls to the SAME row).
    expect((rowA?.config as typeof configA).planName).toBe("Plano de força");
    expect((rowB?.config as typeof configB).planName).toBe("Plano de corrida");
  });

  test("refuses to promote a habit that already carries a DIFFERENT rich kind", async () => {
    const habitId = await Habits.createHabit(
      userId,
      {
        name: "Leitura",
        domainSlug: "education",
        metricType: "binary",
        unit: null,
        target: null,
        minimalAction: "1 página",
        templateKind: "plain",
        why: "Ler mais",
      },
      { source: "human", activeFrom: DATE }
    );
    const ok1 = await Habits.promoteToRichKind(userId, habitId, "leitura", {
      year: 2026,
      targetBooksPerYear: 1,
      books: [],
    });
    expect(ok1).toBe(true);

    // A different kind on an already-rich habit must be refused, not silently
    // overwrite what's there.
    const ok2 = await Habits.promoteToRichKind(userId, habitId, "rotina", {
      blocks: [],
    });
    expect(ok2).toBe(false);

    const row = await Habits.getHabit(userId, habitId);
    expect(row?.templateKind).toBe("leitura");
  });

  test("getHabitByTemplateKind deterministically returns the oldest of two", async () => {
    const older = await Habits.createHabit(
      userId,
      {
        name: "Espiritualidade original",
        domainSlug: "spirituality",
        metricType: "binary",
        unit: null,
        target: null,
        minimalAction: "Orar",
        templateKind: "plain",
        why: "Praticar mais",
      },
      { source: "human", activeFrom: DATE }
    );
    await Habits.promoteToRichKind(userId, older, "espiritualidade", {
      practices: [{ slug: "oracao", name: "Oração", countable: false, position: 0, active: true }],
    });

    const newer = await Habits.createHabit(
      userId,
      {
        name: "Espiritualidade nova",
        domainSlug: "spirituality",
        metricType: "binary",
        unit: null,
        target: null,
        minimalAction: "Meditar",
        templateKind: "plain",
        why: "Meditar mais",
      },
      { source: "human", activeFrom: DATE }
    );
    await Habits.promoteToRichKind(userId, newer, "espiritualidade", {
      practices: [{ slug: "meditacao", name: "Meditação", countable: false, position: 0, active: true }],
    });

    const resolved = await Habits.getHabitByTemplateKind(userId, "espiritualidade");
    expect(resolved?.id).toBe(older);
  });
});
