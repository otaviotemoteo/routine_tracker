// Single data-access layer: the ONLY file (besides seed.ts) that touches
// Drizzle. Routes validate input and call these functions; business math is
// delegated to the pure helpers in src/lib/utils.ts.
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "./index";
import {
  books,
  dailyChecks,
  habits,
  languages,
  readingGoals,
  routineBlocks,
  sleepTargets,
  spiritualPractices,
  workoutPlanDays,
  workoutPlans,
  type PlannedExercise,
} from "./schema";
import {
  addDays,
  calcMonthAdherence,
  calcStreak,
  daysInMonth,
  isoWeekday,
  todayInSaoPaulo,
} from "@/lib/utils";
import { exerciseScheme } from "@/lib/exercise";
import { cellValue, type CellTotals } from "@/lib/cell-value";
import type {
  CheckWithHabit,
  MonthData,
  MonthHabitStats,
  TodayContext,
  WeekCell,
  WeekData,
  WeekHabitRow,
} from "@/types/habit";

const checkWithHabitColumns = {
  id: dailyChecks.id,
  habitId: dailyChecks.habitId,
  checkedAt: dailyChecks.checkedAt,
  done: dailyChecks.done,
  details: dailyChecks.details,
  note: dailyChecks.note,
  name: habits.name,
  slug: habits.slug,
  optional: habits.optional,
};

// Fetch the day's checks, lazily creating the missing ones. The multi-row
// INSERT is a single atomic statement and ON CONFLICT DO NOTHING leans on the
// UNIQUE(habit_id, checked_at) constraint, so concurrent first-loads of the
// same day are safe (the neon-http driver has no interactive transactions).
export async function getDayChecks(date: string): Promise<CheckWithHabit[]> {
  const allHabits = await db.select().from(habits).orderBy(asc(habits.id));
  if (allHabits.length > 0) {
    await db
      .insert(dailyChecks)
      .values(allHabits.map((h) => ({ habitId: h.id, checkedAt: date })))
      .onConflictDoNothing();
  }
  return db
    .select(checkWithHabitColumns)
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .where(eq(dailyChecks.checkedAt, date))
    .orderBy(asc(habits.id));
}

export async function toggleCheck(
  id: number,
  done: boolean
): Promise<CheckWithHabit | null> {
  const [updated] = await db
    .update(dailyChecks)
    .set({ done, updatedAt: new Date() })
    .where(eq(dailyChecks.id, id))
    .returning({ id: dailyChecks.id, habitId: dailyChecks.habitId });
  if (!updated) return null;
  const [row] = await db
    .select(checkWithHabitColumns)
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .where(eq(dailyChecks.id, updated.id));
  return row ?? null;
}

// Everything the Today detail sheets need, resolved for the given day: the
// active plan's day for today's weekday, the current book, the sleep default,
// today's routine blocks, active languages and practices.
export async function getTodayContext(date: string): Promise<TodayContext> {
  const weekday = isoWeekday(date);
  const [plan, book, sleep, blocks, langs, practices] = await Promise.all([
    getActiveWorkoutPlan(),
    getCurrentBook(),
    getSleepTarget(),
    listRoutineBlocks(true),
    listLanguages(true),
    listSpiritualPractices(true),
  ]);
  const planDays =
    plan?.days.map((d) => ({
      id: d.id,
      weekday: d.weekday,
      focus: d.focus,
      exercises: d.exercises,
    })) ?? [];
  return {
    weekday,
    plan: plan
      ? {
          name: plan.name,
          day: planDays.find((d) => d.weekday === weekday) ?? null,
          days: planDays,
        }
      : null,
    book: book
      ? {
          id: book.id,
          title: book.title,
          totalPages: book.totalPages,
          currentPage: book.currentPage,
        }
      : null,
    sleepTarget: sleep
      ? { bedtime: sleep.bedtime.slice(0, 5), wakeTime: sleep.wakeTime.slice(0, 5) }
      : null,
    routineBlocks: blocks
      .filter((b) => b.weekdays.includes(weekday))
      .map((b) => ({
        id: b.id,
        startTime: b.startTime.slice(0, 5),
        endTime: b.endTime.slice(0, 5),
        activity: b.activity,
      })),
    languages: langs.map((l) => ({ slug: l.slug, name: l.name })),
    practices: practices.map((p) => ({
      slug: p.slug,
      name: p.name,
      countable: p.countable,
    })),
  };
}

// When a reading detail is saved, advance the book's current_page and flip it
// to "done" if the last page was reached (spec: mark finished → next book).
export async function applyReadingProgress(
  bookId: number,
  endedOnPage: number,
  date: string
) {
  const book = await getBookById(bookId);
  if (!book) return;
  const patch: Parameters<typeof updateBook>[1] = {
    currentPage: Math.max(book.currentPage, endedOnPage),
  };
  if (!book.startedAt) patch.startedAt = date;
  if (endedOnPage >= book.totalPages) {
    patch.status = "done";
    patch.finishedAt = date;
  } else if (book.status === "queued") {
    patch.status = "reading";
  }
  await updateBook(bookId, patch);
}

// The habit slug for a check id — the API needs it to pick the Zod schema
// before validating incoming details.
export async function getCheckHabitSlug(id: number): Promise<string | null> {
  const [row] = await db
    .select({ slug: habits.slug })
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .where(eq(dailyChecks.id, id));
  return row?.slug ?? null;
}

// Per-habit save from the Today sheet: details (already Zod-validated at the
// API layer) + note + done, in one write.
export async function saveCheckDetails(
  id: number,
  input: { done: boolean; details?: unknown; note?: string | null }
): Promise<CheckWithHabit | null> {
  const [updated] = await db
    .update(dailyChecks)
    .set({
      done: input.done,
      details: input.details ?? null,
      note: input.note ?? null,
      updatedAt: new Date(),
    })
    .where(eq(dailyChecks.id, id))
    .returning({ id: dailyChecks.id });
  if (!updated) return null;
  const [row] = await db
    .select(checkWithHabitColumns)
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .where(eq(dailyChecks.id, id));
  return row ?? null;
}

// ─── Entities (Tier 3) ───────────────────────────────────────────────────────

export interface WorkoutPlanDayInput {
  weekday: number;
  focus: string;
  exercises: PlannedExercise[];
}

export async function getActiveWorkoutPlan() {
  const [plan] = await db
    .select()
    .from(workoutPlans)
    .where(eq(workoutPlans.active, true))
    .orderBy(desc(workoutPlans.version))
    .limit(1);
  if (!plan) return null;
  const days = await db
    .select()
    .from(workoutPlanDays)
    .where(eq(workoutPlanDays.planId, plan.id))
    .orderBy(asc(workoutPlanDays.weekday));
  return { ...plan, days };
}

export function listWorkoutPlanVersions() {
  return db.select().from(workoutPlans).orderBy(asc(workoutPlans.version));
}

// Editing a plan = a NEW immutable version (spec): bump version, deactivate the
// old active one, insert the new plan + its days. History is preserved.
export async function saveWorkoutPlan(
  name: string,
  days: WorkoutPlanDayInput[]
) {
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${workoutPlans.version}), 0)` })
    .from(workoutPlans);
  await db
    .update(workoutPlans)
    .set({ active: false })
    .where(eq(workoutPlans.active, true));
  const [plan] = await db
    .insert(workoutPlans)
    .values({ version: Number(max) + 1, name, active: true })
    .returning();
  if (days.length > 0) {
    await db
      .insert(workoutPlanDays)
      .values(days.map((d) => ({ planId: plan.id, ...d })));
  }
  return plan;
}

export async function getReadingGoal(year: number) {
  const [goal] = await db
    .select()
    .from(readingGoals)
    .where(eq(readingGoals.year, year));
  return goal ?? null;
}

export async function upsertReadingGoal(year: number, targetBooks: number) {
  await db
    .insert(readingGoals)
    .values({ year, targetBooks })
    .onConflictDoUpdate({ target: readingGoals.year, set: { targetBooks } });
}

export function listBooks() {
  return db.select().from(books).orderBy(asc(books.position));
}

export async function getBookById(id: number) {
  const [book] = await db.select().from(books).where(eq(books.id, id));
  return book ?? null;
}

export async function getCurrentBook() {
  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.status, "reading"))
    .orderBy(asc(books.position))
    .limit(1);
  return book ?? null;
}

export async function createBook(input: {
  title: string;
  author?: string | null;
  totalPages: number;
  position: number;
  status?: string;
}) {
  const [book] = await db
    .insert(books)
    .values({
      title: input.title,
      author: input.author ?? null,
      totalPages: input.totalPages,
      position: input.position,
      status: input.status ?? "queued",
    })
    .returning();
  return book;
}

// Reconcile the reading list by id: update the rows that already exist, insert
// the new ones, and delete only books the user removed **and** never touched
// (current_page = 0, still queued/reading). Books with real progress or a
// done/abandoned status are never deleted — past `details.book_id` references
// them. Used by the reading onboarding/config step.
export async function saveReadingList(
  rows: {
    id?: number;
    title: string;
    author: string | null;
    totalPages: number;
    currentPage: number;
    status: string;
    position: number;
  }[]
) {
  const keptIds = rows.map((r) => r.id).filter((id): id is number => !!id);

  const stale = await db
    .select({ id: books.id })
    .from(books)
    .where(
      and(eq(books.currentPage, 0), inArray(books.status, ["queued", "reading"]))
    );
  const toDelete = stale
    .map((s) => s.id)
    .filter((id) => !keptIds.includes(id));
  if (toDelete.length > 0) {
    await db.delete(books).where(inArray(books.id, toDelete));
  }

  for (const row of rows) {
    const values = {
      title: row.title,
      author: row.author,
      totalPages: row.totalPages,
      currentPage: row.currentPage,
      status: row.status,
      position: row.position,
    };
    if (row.id) {
      await db.update(books).set(values).where(eq(books.id, row.id));
    } else {
      await db.insert(books).values(values);
    }
  }
}

export async function updateBook(
  id: number,
  patch: Partial<{
    status: string;
    currentPage: number;
    startedAt: string | null;
    finishedAt: string | null;
    position: number;
  }>
) {
  await db.update(books).set(patch).where(eq(books.id, id));
}

export function listRoutineBlocks(activeOnly = true) {
  const query = db.select().from(routineBlocks);
  return activeOnly
    ? query.where(eq(routineBlocks.active, true)).orderBy(asc(routineBlocks.position))
    : query.orderBy(asc(routineBlocks.position));
}

// Replace the active routine: deactivate the current blocks (never delete —
// past `details` reference their ids) and insert the new set.
export async function replaceRoutineBlocks(
  blocks: {
    startTime: string;
    endTime: string;
    activity: string;
    weekdays: number[];
    position: number;
  }[]
) {
  await db
    .update(routineBlocks)
    .set({ active: false })
    .where(eq(routineBlocks.active, true));
  if (blocks.length > 0) {
    await db.insert(routineBlocks).values(blocks);
  }
}

export function listSpiritualPractices(activeOnly = true) {
  const query = db.select().from(spiritualPractices);
  return activeOnly
    ? query
        .where(eq(spiritualPractices.active, true))
        .orderBy(asc(spiritualPractices.position))
    : query.orderBy(asc(spiritualPractices.position));
}

// Upsert practices by slug (stable identifier) and deactivate any not present.
export async function replaceSpiritualPractices(
  practices: { name: string; slug: string; countable: boolean; position: number }[]
) {
  await db
    .update(spiritualPractices)
    .set({ active: false })
    .where(eq(spiritualPractices.active, true));
  for (const p of practices) {
    await db
      .insert(spiritualPractices)
      .values({ ...p, active: true })
      .onConflictDoUpdate({
        target: spiritualPractices.slug,
        set: {
          name: p.name,
          countable: p.countable,
          position: p.position,
          active: true,
        },
      });
  }
}

export function listLanguages(activeOnly = true) {
  const query = db.select().from(languages);
  return activeOnly
    ? query.where(eq(languages.active, true))
    : query;
}

export async function replaceLanguages(
  items: { name: string; slug: string }[]
) {
  await db
    .update(languages)
    .set({ active: false })
    .where(eq(languages.active, true));
  for (const l of items) {
    await db
      .insert(languages)
      .values({ ...l, active: true })
      .onConflictDoUpdate({
        target: languages.slug,
        set: { name: l.name, active: true },
      });
  }
}

export async function getSleepTarget() {
  const [target] = await db.select().from(sleepTargets).limit(1);
  return target ?? null;
}

// Single-row upsert: update the existing target or insert the first one.
export async function upsertSleepTarget(bedtime: string, wakeTime: string) {
  const existing = await getSleepTarget();
  if (existing) {
    await db
      .update(sleepTargets)
      .set({ bedtime, wakeTime })
      .where(eq(sleepTargets.id, existing.id));
  } else {
    await db.insert(sleepTargets).values({ bedtime, wakeTime });
  }
}

// Onboarding gate: is anything the user must configure present? Seeded
// spiritual-practice defaults are excluded (they always exist), so the check
// looks only at tables the user actively fills.
export async function isConfigured(): Promise<boolean> {
  const [wp, bk, rb, rg, lg, st] = await Promise.all([
    db.$count(workoutPlans),
    db.$count(books),
    db.$count(routineBlocks),
    db.$count(readingGoals),
    db.$count(languages),
    db.$count(sleepTargets),
  ]);
  return wp + bk + rb + rg + lg + st > 0;
}

// Canonical dataset export for a date range — the exact payload a future AI
// analysis consumes (see DATA_DICTIONARY.md). Entities carry full history
// (all workout-plan versions); days hold per-habit {done, details, note}.
export async function getExport(from: string, to: string) {
  const [
    plans,
    planDays,
    bookRows,
    goals,
    blocks,
    practices,
    langs,
    sleep,
    checkRows,
  ] = await Promise.all([
    db.select().from(workoutPlans).orderBy(asc(workoutPlans.version)),
    db.select().from(workoutPlanDays).orderBy(asc(workoutPlanDays.weekday)),
    db.select().from(books).orderBy(asc(books.position)),
    db.select().from(readingGoals).orderBy(asc(readingGoals.year)),
    db.select().from(routineBlocks).orderBy(asc(routineBlocks.position)),
    db.select().from(spiritualPractices).orderBy(asc(spiritualPractices.position)),
    db.select().from(languages).orderBy(asc(languages.id)),
    db.select().from(sleepTargets),
    db
      .select({
        date: dailyChecks.checkedAt,
        slug: habits.slug,
        done: dailyChecks.done,
        details: dailyChecks.details,
        note: dailyChecks.note,
      })
      .from(dailyChecks)
      .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
      .where(and(gte(dailyChecks.checkedAt, from), lte(dailyChecks.checkedAt, to)))
      .orderBy(asc(dailyChecks.checkedAt), asc(habits.id)),
  ]);

  const daysByPlan = new Map<number, typeof planDays>();
  for (const d of planDays) {
    const list = daysByPlan.get(d.planId) ?? [];
    list.push(d);
    daysByPlan.set(d.planId, list);
  }

  const daysMap = new Map<
    string,
    Record<string, { done: boolean; details: unknown; note: string | null }>
  >();
  for (const row of checkRows) {
    const day = daysMap.get(row.date) ?? {};
    day[row.slug] = { done: row.done, details: row.details, note: row.note };
    daysMap.set(row.date, day);
  }

  // Emit snake_case throughout so the whole export is self-consistent with the
  // `details` fields and DATA_DICTIONARY.md (Drizzle rows are camelCase).
  return {
    meta: { from, to, timezone: "America/Sao_Paulo", schema_version: 2 },
    entities: {
      workout_plans: plans.map((p) => ({
        id: p.id,
        version: p.version,
        name: p.name,
        active: p.active,
        created_at: p.createdAt,
        days: (daysByPlan.get(p.id) ?? []).map((d) => ({
          id: d.id,
          plan_id: d.planId,
          weekday: d.weekday,
          focus: d.focus,
          exercises: d.exercises,
        })),
      })),
      books: bookRows.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        total_pages: b.totalPages,
        status: b.status,
        current_page: b.currentPage,
        position: b.position,
        started_at: b.startedAt,
        finished_at: b.finishedAt,
      })),
      reading_goals: goals.map((g) => ({
        id: g.id,
        year: g.year,
        target_books: g.targetBooks,
        created_at: g.createdAt,
      })),
      routine_blocks: blocks.map((b) => ({
        id: b.id,
        start_time: b.startTime.slice(0, 5),
        end_time: b.endTime.slice(0, 5),
        activity: b.activity,
        weekdays: b.weekdays,
        active: b.active,
        position: b.position,
      })),
      spiritual_practices: practices.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        countable: p.countable,
        active: p.active,
        position: p.position,
      })),
      languages: langs.map((l) => ({
        id: l.id,
        name: l.name,
        slug: l.slug,
        active: l.active,
      })),
      sleep_targets: sleep.map((s) => ({
        id: s.id,
        bedtime: s.bedtime.slice(0, 5),
        wake_time: s.wakeTime.slice(0, 5),
      })),
    },
    days: [...daysMap.entries()].map(([date, habitsForDay]) => ({
      date,
      habits: habitsForDay,
    })),
  };
}

export interface AuditLookups {
  books: Record<number, string>;
  planDays: Record<number, string>;
  // plan_day_id → exercise name → "3×8" (empty when the plan omits sets/reps)
  planExercises: Record<number, Record<string, string>>;
  blocks: Record<number, string>;
  languages: Record<string, string>;
  practices: Record<string, string>;
}

// Id/slug → display-name maps so the Day Audit can render details
// human-readably (book title, plan focus, block activity, language/practice
// names). Includes inactive rows so historical references still resolve.
export async function getAuditLookups(): Promise<AuditLookups> {
  const [bks, planDays, blocks, langs, pracs] = await Promise.all([
    db.select({ id: books.id, title: books.title }).from(books),
    db
      .select({
        id: workoutPlanDays.id,
        focus: workoutPlanDays.focus,
        exercises: workoutPlanDays.exercises,
      })
      .from(workoutPlanDays),
    db
      .select({ id: routineBlocks.id, activity: routineBlocks.activity })
      .from(routineBlocks),
    db.select({ slug: languages.slug, name: languages.name }).from(languages),
    db
      .select({ slug: spiritualPractices.slug, name: spiritualPractices.name })
      .from(spiritualPractices),
  ]);
  return {
    books: Object.fromEntries(bks.map((b) => [b.id, b.title])),
    planDays: Object.fromEntries(planDays.map((d) => [d.id, d.focus])),
    planExercises: Object.fromEntries(
      planDays.map((d) => [
        d.id,
        Object.fromEntries(d.exercises.map((e) => [e.name, exerciseScheme(e)])),
      ])
    ),
    blocks: Object.fromEntries(blocks.map((b) => [b.id, b.activity])),
    languages: Object.fromEntries(langs.map((l) => [l.slug, l.name])),
    practices: Object.fromEntries(pracs.map((p) => [p.slug, p.name])),
  };
}

// Read-only day fetch for the Day Audit (never lazily creates rows, unlike
// getDayChecks — a past day being viewed shouldn't materialize empty checks).
export function getDayChecksReadonly(date: string): Promise<CheckWithHabit[]> {
  return db
    .select(checkWithHabitColumns)
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .where(eq(dailyChecks.checkedAt, date))
    .orderBy(asc(habits.id));
}

// Consecutive days where every required habit was done — the same rule as a
// habit streak (count back from yesterday, +1 if today already qualifies), so
// an unfinished today never zeroes it. Bounded to a window; a streak longer
// than that is beyond what this screen needs to say.
const STREAK_WINDOW_DAYS = 180;

export async function getDayStreak(today: string): Promise<number> {
  const requiredCount = await db.$count(habits, eq(habits.optional, false));
  if (requiredCount === 0) return 0;

  const rows = await db
    .select({
      date: dailyChecks.checkedAt,
      done: sql<number>`count(*)`.as("done"),
    })
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .where(
      and(
        eq(dailyChecks.done, true),
        eq(habits.optional, false),
        gte(dailyChecks.checkedAt, addDays(today, -STREAK_WINDOW_DAYS)),
        lte(dailyChecks.checkedAt, today)
      )
    )
    .groupBy(dailyChecks.checkedAt);

  const complete = new Set(
    rows.filter((r) => Number(r.done) >= requiredCount).map((r) => r.date)
  );
  return calcStreak(complete, today);
}

// How many routine blocks and spiritual practices are configured, so a grid
// cell can say "4/6" rather than "4".
async function getCellTotals(): Promise<CellTotals> {
  const [routineBlockCount, practiceCount] = await Promise.all([
    db.$count(routineBlocks),
    db.$count(spiritualPractices),
  ]);
  return { routineBlocks: routineBlockCount, practices: practiceCount };
}

export interface MonthMatrixDay {
  date: string;
  dayOfMonth: number;
  weekday: number; // ISO 1..7
  doneCount: number; // required habits only — the heat level
  // Per-habit outcome for the tooltip, in habit order.
  habits: { slug: string; name: string; done: boolean; value: string | null }[];
}

export interface MonthMatrix {
  month: string;
  days: MonthMatrixDay[];
  requiredCount: number;
}

// Every day of the month with its per-habit outcome — feeds both the calendar
// heat and the tooltip, so they can never disagree.
export async function getMonthMatrix(month: string): Promise<MonthMatrix> {
  const total = daysInMonth(month);
  const first = `${month}-01`;
  const last = `${month}-${String(total).padStart(2, "0")}`;

  const [allHabits, rows, totals] = await Promise.all([
    db.select().from(habits).orderBy(asc(habits.id)),
    db
      .select({
        habitId: dailyChecks.habitId,
        checkedAt: dailyChecks.checkedAt,
        done: dailyChecks.done,
        details: dailyChecks.details,
      })
      .from(dailyChecks)
      .where(
        and(gte(dailyChecks.checkedAt, first), lte(dailyChecks.checkedAt, last))
      ),
    getCellTotals(),
  ]);

  const byHabitDay = new Map<string, { done: boolean; details: unknown }>();
  for (const row of rows) {
    byHabitDay.set(`${row.habitId}:${row.checkedAt}`, {
      done: row.done,
      details: row.details,
    });
  }

  const days: MonthMatrixDay[] = Array.from({ length: total }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const perHabit = allHabits.map((h) => {
      const entry = byHabitDay.get(`${h.id}:${date}`);
      const done = entry?.done ?? false;
      return {
        slug: h.slug,
        name: h.name,
        done,
        value: cellValue(h.slug, entry?.details, done, totals)?.label ?? null,
        optional: h.optional,
      };
    });
    return {
      date,
      dayOfMonth: i + 1,
      weekday: isoWeekday(date),
      doneCount: perHabit.filter((p) => p.done && !p.optional).length,
      habits: perHabit.map(({ slug, name, done, value }) => ({
        slug,
        name,
        done,
        value,
      })),
    };
  });

  return {
    month,
    days,
    requiredCount: allHabits.filter((h) => !h.optional).length,
  };
}

// Done-days per habit for a month — used for the consistency panel's
// "vs. previous month" delta.
export async function getMonthDoneCounts(
  month: string
): Promise<Record<string, number>> {
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const rows = await db
    .select({ slug: habits.slug, count: sql<number>`count(*)`.as("count") })
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .where(
      and(
        eq(dailyChecks.done, true),
        gte(dailyChecks.checkedAt, first),
        lte(dailyChecks.checkedAt, last)
      )
    )
    .groupBy(habits.slug);
  return Object.fromEntries(rows.map((r) => [r.slug, Number(r.count)]));
}

export interface MonthDetailStats {
  sleep: { avgHours: number | null; nights: number };
  reading: { totalPages: number };
  workout: { percent: number; days: number };
  duolingo: { total: number; perLanguage: { slug: string; lessons: number }[] };
  spirituality: { totalCheckins: number };
}

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

// Per-area rich summaries for the month view, aggregated from the JSONB details
// in JS (simpler than JSONB SQL at this scale — ≤ 7 rows/day).
export async function getMonthDetailStats(
  month: string
): Promise<MonthDetailStats> {
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const rows = await db
    .select({ slug: habits.slug, details: dailyChecks.details })
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .where(
      and(
        gte(dailyChecks.checkedAt, first),
        lte(dailyChecks.checkedAt, last),
        isNotNull(dailyChecks.details)
      )
    );

  const hours: number[] = [];
  let totalPages = 0;
  let exDone = 0;
  let exTotal = 0;
  let workoutDays = 0;
  const lessonsBySlug = new Map<string, number>();
  let practiceCheckins = 0;

  for (const row of rows) {
    const d = rec(row.details);
    if (!d) continue;
    switch (row.slug) {
      case "sono":
        if (typeof d.hours === "number") hours.push(d.hours);
        break;
      case "leitura":
        if (typeof d.pages_read === "number") totalPages += d.pages_read;
        break;
      case "treino":
        if (Array.isArray(d.completed)) {
          workoutDays += 1;
          exTotal += d.completed.length;
          exDone += d.completed.filter((e) => rec(e)?.done === true).length;
        }
        break;
      case "duolingo":
        if (Array.isArray(d.sessions)) {
          for (const s of d.sessions) {
            const sr = rec(s);
            const slug = typeof sr?.language_slug === "string" ? sr.language_slug : null;
            const lessons = typeof sr?.lessons === "number" ? sr.lessons : 0;
            if (slug) lessonsBySlug.set(slug, (lessonsBySlug.get(slug) ?? 0) + lessons);
          }
        }
        break;
      case "espiritualidade":
        if (Array.isArray(d.practices)) practiceCheckins += d.practices.length;
        break;
    }
  }

  return {
    sleep: {
      avgHours:
        hours.length > 0
          ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10
          : null,
      nights: hours.length,
    },
    reading: { totalPages },
    workout: {
      percent: exTotal === 0 ? 0 : Math.round((exDone / exTotal) * 100),
      days: workoutDays,
    },
    duolingo: {
      total: [...lessonsBySlug.values()].reduce((a, b) => a + b, 0),
      perLanguage: [...lessonsBySlug.entries()].map(([slug, lessons]) => ({
        slug,
        lessons,
      })),
    },
    spirituality: { totalCheckins: practiceCheckins },
  };
}

// 7 days × 7 habits starting at a Monday. Days with no row simply count as
// not done — the week view never creates rows.
export async function getWeekData(start: string): Promise<WeekData> {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  // Only the days that have happened count towards the percentage — a habit
  // done on all three days so far is at 100%, not 43%.
  const today = todayInSaoPaulo();
  const elapsed = days.filter((d) => d <= today).length || 7;
  // Details come along so each cell can carry its own figure ("9 pg", "4/6")
  // instead of a bare tick.
  const [allHabits, rows, totals] = await Promise.all([
    db.select().from(habits).orderBy(asc(habits.id)),
    db
      .select({
        habitId: dailyChecks.habitId,
        checkedAt: dailyChecks.checkedAt,
        done: dailyChecks.done,
        details: dailyChecks.details,
      })
      .from(dailyChecks)
      .where(
        and(
          gte(dailyChecks.checkedAt, start),
          lte(dailyChecks.checkedAt, days[6])
        )
      ),
    getCellTotals(),
  ]);

  const byHabitDay = new Map<string, { done: boolean; details: unknown }>();
  for (const row of rows) {
    byHabitDay.set(`${row.habitId}:${row.checkedAt}`, {
      done: row.done,
      details: row.details,
    });
  }

  const habitRows: WeekHabitRow[] = allHabits.map((h) => {
    const cells: WeekCell[] = days.map((day) => {
      const entry = byHabitDay.get(`${h.id}:${day}`);
      const done = entry?.done ?? false;
      const value = cellValue(h.slug, entry?.details, done, totals);
      return {
        done,
        value: value?.label ?? null,
        partial: done && (value?.partial ?? false),
      };
    });
    const doneCount = cells.filter((c) => c.done).length;
    return {
      habitId: h.id,
      name: h.name,
      slug: h.slug,
      optional: h.optional,
      done: cells.map((c) => c.done),
      cells,
      percent: Math.round((doneCount / elapsed) * 100),
    };
  });

  // Best/worst of the week among REQUIRED habits only (README Decision 6);
  // null when nothing was checked in the week at all.
  const required = habitRows.filter((h) => !h.optional);
  const counts = required.map((h) => h.done.filter(Boolean).length);
  let bestSlug: string | null = null;
  let worstSlug: string | null = null;
  if (counts.some((c) => c > 0)) {
    bestSlug = required[counts.indexOf(Math.max(...counts))].slug;
    worstSlug = required[counts.indexOf(Math.min(...counts))].slug;
  }

  return { start, days, habits: habitRows, bestSlug, worstSlug };
}

// Adherence % (README Decision 5) + current streak (Decision 4) per habit.
// The streak is always the CURRENT streak, so it reads from all done rows up
// to today regardless of which month is being viewed — fine at this scale
// (7 habits, one row per habit per day).
export async function getMonthData(
  month: string,
  today: string
): Promise<MonthData> {
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const [allHabits, monthRows, streakRows] = await Promise.all([
    db.select().from(habits).orderBy(asc(habits.id)),
    db
      .select({ habitId: dailyChecks.habitId, checkedAt: dailyChecks.checkedAt })
      .from(dailyChecks)
      .where(
        and(
          gte(dailyChecks.checkedAt, first),
          lte(dailyChecks.checkedAt, last),
          eq(dailyChecks.done, true)
        )
      ),
    db
      .select({ habitId: dailyChecks.habitId, checkedAt: dailyChecks.checkedAt })
      .from(dailyChecks)
      .where(and(eq(dailyChecks.done, true), lte(dailyChecks.checkedAt, today))),
  ]);

  const doneInMonth = new Map<number, number>();
  for (const row of monthRows) {
    doneInMonth.set(row.habitId, (doneInMonth.get(row.habitId) ?? 0) + 1);
  }
  const doneDatesByHabit = new Map<number, Set<string>>();
  for (const row of streakRows) {
    const set = doneDatesByHabit.get(row.habitId) ?? new Set<string>();
    set.add(row.checkedAt);
    doneDatesByHabit.set(row.habitId, set);
  }

  const stats: MonthHabitStats[] = allHabits.map((h) => {
    const adherence = calcMonthAdherence(
      month,
      today,
      doneInMonth.get(h.id) ?? 0
    );
    return {
      habitId: h.id,
      name: h.name,
      slug: h.slug,
      optional: h.optional,
      ...adherence,
      streak: calcStreak(doneDatesByHabit.get(h.id) ?? new Set(), today),
    };
  });

  return { month, habits: stats };
}
