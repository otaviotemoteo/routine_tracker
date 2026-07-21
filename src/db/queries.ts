// Single data-access layer: the ONLY file (besides seed.ts) that touches
// Drizzle. Routes validate input and call these functions; business math is
// delegated to the pure helpers in src/lib/utils.ts.
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "./index";
import { dailyChecks, habits } from "./schema";
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
