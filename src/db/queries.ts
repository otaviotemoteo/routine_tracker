// Single data-access layer: the ONLY file (besides seed.ts) that touches
// Drizzle. Routes validate input and call these functions; business math is
// delegated to the pure helpers in src/lib/utils.ts.
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
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
} from "@/lib/utils";
import type {
  CheckWithHabit,
  MonthData,
  MonthHabitStats,
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

// Batch save for the Today screen: the user picks the whole day and confirms
// once. Grouped into at most two UPDATEs (done true / done false) so the save
// is a single round trip per group instead of one request per habit.
export async function setChecksDone(
  updates: { id: number; done: boolean }[]
): Promise<CheckWithHabit[]> {
  if (updates.length === 0) return [];
  const now = new Date();
  const doneIds = updates.filter((u) => u.done).map((u) => u.id);
  const undoneIds = updates.filter((u) => !u.done).map((u) => u.id);

  if (doneIds.length > 0) {
    await db
      .update(dailyChecks)
      .set({ done: true, updatedAt: now })
      .where(inArray(dailyChecks.id, doneIds));
  }
  if (undoneIds.length > 0) {
    await db
      .update(dailyChecks)
      .set({ done: false, updatedAt: now })
      .where(inArray(dailyChecks.id, undoneIds));
  }

  return db
    .select(checkWithHabitColumns)
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .where(
      inArray(
        dailyChecks.id,
        updates.map((u) => u.id)
      )
    )
    .orderBy(asc(habits.id));
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

// Replace the not-yet-started books (current_page = 0, still queued/reading)
// with a fresh list — used by the reading onboarding/config step. Books with
// real progress or a finished/abandoned status are preserved (and may be
// referenced by past `details.book_id`, so they're never deleted here).
export async function replaceUntouchedBooks(
  rows: {
    title: string;
    author: string | null;
    totalPages: number;
    status: string;
    position: number;
  }[]
) {
  await db
    .delete(books)
    .where(
      and(eq(books.currentPage, 0), inArray(books.status, ["queued", "reading"]))
    );
  if (rows.length > 0) {
    await db.insert(books).values(rows);
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

// 7 days × 7 habits starting at a Monday. Days with no row simply count as
// not done — the week view never creates rows.
export async function getWeekData(start: string): Promise<WeekData> {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const [allHabits, doneRows] = await Promise.all([
    db.select().from(habits).orderBy(asc(habits.id)),
    db
      .select({ habitId: dailyChecks.habitId, checkedAt: dailyChecks.checkedAt })
      .from(dailyChecks)
      .where(
        and(
          gte(dailyChecks.checkedAt, start),
          lte(dailyChecks.checkedAt, days[6]),
          eq(dailyChecks.done, true)
        )
      ),
  ]);

  const doneByHabit = new Map<number, Set<string>>();
  for (const row of doneRows) {
    const set = doneByHabit.get(row.habitId) ?? new Set<string>();
    set.add(row.checkedAt);
    doneByHabit.set(row.habitId, set);
  }

  const habitRows: WeekHabitRow[] = allHabits.map((h) => ({
    habitId: h.id,
    name: h.name,
    slug: h.slug,
    optional: h.optional,
    done: days.map((d) => doneByHabit.get(h.id)?.has(d) ?? false),
  }));

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
