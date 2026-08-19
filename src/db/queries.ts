// Single data-access layer: the ONLY file (besides seed.ts) that touches
// Drizzle. Routes validate input and call these functions; business math is
// delegated to the pure helpers in src/lib/utils.ts.
import { and, asc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "./index";
import { habitsFor, habitsForRange, type UserId } from "./scope";
import { dailyChecks, habits, lifeDomains } from "./schema";
import {
  getBookById,
  getCurrentBook,
  getDuolingoConfig,
  getReadingConfig,
  getRoutineConfig,
  getSleepConfig,
  getSpiritualityConfig,
  getWorkoutConfig,
  listBooks,
  listLanguages,
  listRoutineBlocks,
  listSpiritualPractices,
  updateBook,
} from "./rich-habits";
import {
  addDays,
  calcMonthAdherence,
  calcStreak,
  countTrackedDays,
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

// The habit fields the week grid and month view need, plus the area slug for
// the icon. A left join, so an unanchored habit still appears.
const habitListColumns = {
  id: habits.id,
  name: habits.name,
  slug: habits.slug,
  optional: habits.optional,
  templateKind: habits.templateKind,
  target: habits.target,
  domainSlug: lifeDomains.slug,
};

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
  // The renderers key on templateKind now rather than on slug. For the seven
  // migrated habits the two are equal, so nothing about them changed; for
  // everything else it is null and the generic renderer takes over.
  templateKind: habits.templateKind,
  metricType: habits.metricType,
  unit: habits.unit,
  target: habits.target,
  minimalAction: habits.minimalAction,
  // Template-kind-specific setup (today: the checklist kind's item labels).
  // Read on Today's card and the checklist check-in step; every other kind
  // ignores it.
  config: habits.config,
  // The life area, for the icon a plain habit falls back to. Left-joined, so
  // a habit added before any assessment simply has none.
  domainSlug: lifeDomains.slug,
};

// Fetch the day's checks, lazily creating the missing ones. The multi-row
// INSERT is a single atomic statement and ON CONFLICT DO NOTHING leans on the
// UNIQUE(habit_id, checked_at) constraint, so concurrent first-loads of the
// same day are safe (the neon-http driver has no interactive transactions).
export async function getDayChecks(
  userId: UserId,
  date: string
): Promise<CheckWithHabit[]> {
  // Scoped to the owner AND to the day: habitsFor() excludes habits that were
  // removed before this date, ones that started after it, and proposals that
  // have never been accepted. Without the window this would keep materialising
  // checks for a removed habit forever.
  const allHabits = await db
    .select()
    .from(habits)
    .where(habitsFor(userId, date))
    .orderBy(asc(habits.position), asc(habits.id));
  if (allHabits.length > 0) {
    await db
      .insert(dailyChecks)
      .values(allHabits.map((h) => ({ userId, habitId: h.id, checkedAt: date })))
      .onConflictDoNothing();
  }
  // The read is scoped again rather than trusting the insert above: a check
  // written on a day the habit was still live must not resurface on Today
  // after the habit is removed.
  return db
    .select(checkWithHabitColumns)
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .leftJoin(lifeDomains, eq(habits.domainId, lifeDomains.id))
    .where(
      and(
        eq(dailyChecks.userId, userId),
        eq(dailyChecks.checkedAt, date),
        habitsFor(userId, date)
      )
    )
    .orderBy(asc(habits.position), asc(habits.id));
}

// Every id-addressed write carries the user in its WHERE clause: an id from
// somebody else's account simply matches no row, rather than being mutated.
export async function toggleCheck(
  userId: UserId,
  id: number,
  done: boolean
): Promise<CheckWithHabit | null> {
  const [updated] = await db
    .update(dailyChecks)
    .set({ done, updatedAt: new Date() })
    .where(and(eq(dailyChecks.id, id), eq(dailyChecks.userId, userId)))
    .returning({ id: dailyChecks.id, habitId: dailyChecks.habitId });
  if (!updated) return null;
  const [row] = await db
    .select(checkWithHabitColumns)
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .leftJoin(lifeDomains, eq(habits.domainId, lifeDomains.id))
    .where(eq(dailyChecks.id, updated.id));
  return row ?? null;
}

// Everything the Today detail sheets need, resolved for the given day: the
// active plan's day for today's weekday, the current book, the sleep default,
// today's routine blocks, active languages and practices.
export async function getTodayContext(
  userId: UserId,
  date: string
): Promise<TodayContext> {
  const weekday = isoWeekday(date);
  const [workout, book, sleep, blocks, langs, practices, allBooks] =
    await Promise.all([
      getWorkoutConfig(userId),
      getCurrentBook(userId),
      getSleepConfig(userId),
      listRoutineBlocks(userId, true),
      listLanguages(userId, true),
      listSpiritualPractices(userId, true),
      listBooks(userId),
    ]);
  // Only the active days are "the current plan" — a retired day (superseded
  // by a later save) stays in config for old check-ins to resolve, but Today
  // has no business scheduling against it.
  const planDays =
    workout?.days.filter((d) => d.active).map((d) => ({
      id: d.id,
      weekday: d.weekday,
      focus: d.focus,
      exercises: d.exercises,
    })) ?? [];
  return {
    weekday,
    plan: workout
      ? {
          name: workout.planName,
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
          // What comes after this one, in reading order — the card shows the
          // road ahead, not just the book in hand.
          queue: allBooks
            .filter((b) => b.id !== book.id && b.status === "queued")
            .map((b) => ({ title: b.title, totalPages: b.totalPages })),
        }
      : null,
    sleepTarget: sleep ? { bedtime: sleep.bedtime, wakeTime: sleep.wakeTime } : null,
    routineBlocks: blocks
      .filter((b) => b.weekdays.includes(weekday))
      .map((b) => ({
        id: b.id,
        startTime: b.startTime,
        endTime: b.endTime,
        activity: b.activity,
      })),
    // Unfiltered — see TodayContext's own comment on why this has to travel
    // separately from the today-filtered list above.
    routineBlockCount: blocks.length,
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
  userId: UserId,
  bookId: number,
  endedOnPage: number,
  date: string
) {
  const book = await getBookById(userId, bookId);
  if (!book) return;
  const patch: Parameters<typeof updateBook>[2] = {
    currentPage: Math.max(book.currentPage, endedOnPage),
  };
  if (!book.startedAt) patch.startedAt = date;
  if (endedOnPage >= book.totalPages) {
    patch.status = "done";
    patch.finishedAt = date;
  } else if (book.status === "queued") {
    patch.status = "reading";
  }
  await updateBook(userId, bookId, patch);
}

// What the API needs about a check's habit before it can validate incoming
// details: the template kind picks the Zod schema, and the reading
// side-effect keys on it too. Null for a check that isn't yours.
//
// This returns the TEMPLATE KIND rather than the slug, and the distinction is
// load-bearing now: slugs are per-account, so somebody else's habit could be
// slugged "leitura" without being a reading habit at all. Keying the schema
// or the book-advancing side-effect on the slug would fire the wrong
// behaviour on their data.
export async function getCheckTemplateKind(
  userId: UserId,
  id: number
): Promise<{ templateKind: string | null } | null> {
  const [row] = await db
    .select({ templateKind: habits.templateKind })
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .where(and(eq(dailyChecks.id, id), eq(dailyChecks.userId, userId)));
  return row ?? null;
}

// Per-habit save from the Today sheet: details (already Zod-validated at the
// API layer) + note + done, in one write.
export async function saveCheckDetails(
  userId: UserId,
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
    .where(and(eq(dailyChecks.id, id), eq(dailyChecks.userId, userId)))
    .returning({ id: dailyChecks.id });
  if (!updated) return null;
  const [row] = await db
    .select(checkWithHabitColumns)
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .leftJoin(lifeDomains, eq(habits.domainId, lifeDomains.id))
    .where(eq(dailyChecks.id, id));
  return row ?? null;
}

// Canonical dataset export for a date range — the exact payload a future AI
// analysis consumes (see docs/DATA_DICTIONARY.md). Entities carry full history
// (all workout-plan versions); days hold per-habit {done, details, note}.
export async function getExport(userId: UserId, from: string, to: string) {
  const [workout, reading, routine, spirituality, duolingo, sleep, checkRows] =
    await Promise.all([
      getWorkoutConfig(userId),
      getReadingConfig(userId),
      getRoutineConfig(userId),
      getSpiritualityConfig(userId),
      getDuolingoConfig(userId),
      getSleepConfig(userId),
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
        .where(
          and(
            eq(dailyChecks.userId, userId),
            gte(dailyChecks.checkedAt, from),
            lte(dailyChecks.checkedAt, to)
          )
        )
        .orderBy(asc(dailyChecks.checkedAt), asc(habits.id)),
    ]);

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
  // `details` fields and docs/DATA_DICTIONARY.md (Drizzle rows are camelCase).
  //
  // These six entities now live in each habit's own `config` rather than a
  // dedicated table — see docs/DATA_DICTIONARY.md for the updated shape.
  // `workout_plans`/`reading_goals` no longer carry separate ids or
  // created-at timestamps (config has no history beyond `days[].active`),
  // and `spiritual_practices`/`languages` are identified by `slug` alone,
  // not a numeric id — neither was ever referenced by one.
  return {
    meta: { from, to, timezone: "America/Sao_Paulo", schema_version: 3 },
    entities: {
      workout_plans: workout
        ? [
            {
              name: workout.planName,
              days: workout.days.map((d) => ({
                id: d.id,
                weekday: d.weekday,
                focus: d.focus,
                exercises: d.exercises,
                active: d.active,
              })),
            },
          ]
        : [],
      books: (reading?.books ?? []).map((b) => ({
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
      reading_goals:
        reading && reading.targetBooksPerYear
          ? [{ year: reading.year, target_books: reading.targetBooksPerYear }]
          : [],
      routine_blocks: (routine?.blocks ?? []).map((b) => ({
        id: b.id,
        start_time: b.startTime,
        end_time: b.endTime,
        activity: b.activity,
        weekdays: b.weekdays,
        active: b.active,
        position: b.position,
      })),
      spiritual_practices: (spirituality?.practices ?? []).map((p) => ({
        name: p.name,
        slug: p.slug,
        countable: p.countable,
        active: p.active,
        position: p.position,
      })),
      languages: (duolingo?.languages ?? []).map((l) => ({
        name: l.name,
        slug: l.slug,
        active: l.active,
      })),
      sleep_targets: sleep ? [{ bedtime: sleep.bedtime, wake_time: sleep.wakeTime }] : [],
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
export async function getAuditLookups(userId: UserId): Promise<AuditLookups> {
  const [reading, workout, routine, duolingo, spirituality] = await Promise.all([
    getReadingConfig(userId),
    getWorkoutConfig(userId),
    getRoutineConfig(userId),
    getDuolingoConfig(userId),
    getSpiritualityConfig(userId),
  ]);
  const planDays = workout?.days ?? [];
  return {
    books: Object.fromEntries((reading?.books ?? []).map((b) => [b.id, b.title])),
    planDays: Object.fromEntries(planDays.map((d) => [d.id, d.focus])),
    planExercises: Object.fromEntries(
      planDays.map((d) => [
        d.id,
        Object.fromEntries(d.exercises.map((e) => [e.name, exerciseScheme(e)])),
      ])
    ),
    blocks: Object.fromEntries(
      (routine?.blocks ?? []).map((b) => [b.id, b.activity])
    ),
    languages: Object.fromEntries(
      (duolingo?.languages ?? []).map((l) => [l.slug, l.name])
    ),
    practices: Object.fromEntries(
      (spirituality?.practices ?? []).map((p) => [p.slug, p.name])
    ),
  };
}

// Read-only day fetch for the Day Audit (never lazily creates rows, unlike
// getDayChecks — a past day being viewed shouldn't materialize empty checks).
export function getDayChecksReadonly(
  userId: UserId,
  date: string
): Promise<CheckWithHabit[]> {
  // Scoped to the day being audited, so a habit removed last month doesn't
  // reappear in the record of a day it was still being tracked on — and, more
  // importantly, so this can never read across accounts.
  return db
    .select(checkWithHabitColumns)
    .from(dailyChecks)
    .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
    .leftJoin(lifeDomains, eq(habits.domainId, lifeDomains.id))
    .where(
      and(
        eq(dailyChecks.userId, userId),
        eq(dailyChecks.checkedAt, date),
        habitsFor(userId, date)
      )
    )
    .orderBy(asc(habits.position), asc(habits.id));
}

// Consecutive days where every required habit was done — the same rule as a
// habit streak (count back from yesterday, +1 if today already qualifies), so
// an unfinished today never zeroes it. Bounded to a window; a streak longer
// than that is beyond what this screen needs to say.
const STREAK_WINDOW_DAYS = 180;

export async function getDayStreak(
  userId: UserId,
  today: string
): Promise<number> {
  // Counts THIS user's currently-tracked required habits. Before habits were
  // per-user this was a global count, which as soon as two accounts existed
  // would have measured everyone's habits against one person's checks.
  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(habits)
    .where(and(habitsFor(userId, today), eq(habits.optional, false)));
  const requiredCount = countRow?.n ?? 0;
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
        eq(dailyChecks.userId, userId),
        eq(dailyChecks.done, true),
        eq(habits.optional, false),
        eq(habits.userId, userId),
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

// The one line of "how does today compare" each Today card is allowed to make.
// Relative days only, never clock times: `created_at` exists but a row written
// at 00:30 or edited a week later would misreport when the thing happened.
export interface TodayComparisons {
  streak: Record<string, number>; // per slug, current run of done days
  lastDone: Record<string, string>; // per slug, last done day before today
  avgSleepHours: number | null; // trailing 7 days
  avgRoutineBlocks: number | null; // trailing 7 days
  // Last nights' hours, oldest first — the sleep card plots them.
  recentSleep: { date: string; hours: number }[];
  // Trailing 7 days per language slug / practice slug.
  weekLessons: Record<string, number>;
  weekPractices: Record<string, number>;
  // Hobby has no configured plan to show, so its card leans on recent history.
  hobbySessions: number; // trailing 7 days
  hobbyMinutes: number; // trailing 7 days
}

const RECENT_WINDOW_DAYS = 7;

export async function getTodayComparisons(
  userId: UserId,
  today: string
): Promise<TodayComparisons> {
  const [doneRows, recentRows] = await Promise.all([
    db
      .select({ slug: habits.slug, date: dailyChecks.checkedAt })
      .from(dailyChecks)
      .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
      .where(
        and(
          eq(dailyChecks.userId, userId),
          eq(dailyChecks.done, true),
          gte(dailyChecks.checkedAt, addDays(today, -STREAK_WINDOW_DAYS)),
          lte(dailyChecks.checkedAt, today)
        )
      ),
    // Filtered by templateKind, not slug: a slug is per-account free text
    // (two accounts can each slug a habit "sono" without either being a
    // sleep habit at all), so matching on it here would silently mix up
    // whose comparisons are whose the moment slugs diverge from kind — which
    // Phase 3 makes more likely, not less, since these kinds are no longer
    // reserved to one migrated account.
    db
      .select({
        templateKind: habits.templateKind,
        date: dailyChecks.checkedAt,
        details: dailyChecks.details,
      })
      .from(dailyChecks)
      .innerJoin(habits, eq(dailyChecks.habitId, habits.id))
      .where(
        and(
          eq(dailyChecks.userId, userId),
          eq(dailyChecks.done, true),
          inArray(habits.templateKind, [
            "sono",
            "rotina",
            "hobby",
            "duolingo",
            "espiritualidade",
          ]),
          gte(dailyChecks.checkedAt, addDays(today, -RECENT_WINDOW_DAYS)),
          lte(dailyChecks.checkedAt, addDays(today, -1))
        )
      )
      .orderBy(asc(dailyChecks.checkedAt)),
  ]);

  const datesBySlug = new Map<string, Set<string>>();
  for (const row of doneRows) {
    const set = datesBySlug.get(row.slug) ?? new Set<string>();
    set.add(row.date);
    datesBySlug.set(row.slug, set);
  }

  const streak: Record<string, number> = {};
  const lastDone: Record<string, string> = {};
  for (const [slug, dates] of datesBySlug) {
    streak[slug] = calcStreak(dates, today);
    // "Last time" means the last time before today — a card asking you to log
    // today shouldn't answer "today".
    const previous = [...dates].filter((d) => d < today).sort();
    if (previous.length > 0) lastDone[slug] = previous[previous.length - 1];
  }

  const average = (values: number[]) =>
    values.length === 0
      ? null
      : values.reduce((sum, v) => sum + v, 0) / values.length;

  const recentSleep: { date: string; hours: number }[] = [];
  const routineBlockCounts: number[] = [];
  const weekLessons: Record<string, number> = {};
  const weekPractices: Record<string, number> = {};
  let hobbySessions = 0;
  let hobbyMinutes = 0;
  for (const row of recentRows) {
    const d = rec(row.details);
    if (!d) continue;
    if (row.templateKind === "sono" && typeof d.hours === "number") {
      recentSleep.push({ date: row.date, hours: d.hours });
    }
    if (row.templateKind === "rotina" && Array.isArray(d.followed_block_ids)) {
      routineBlockCounts.push(d.followed_block_ids.length);
    }
    if (row.templateKind === "duolingo" && Array.isArray(d.sessions)) {
      for (const session of d.sessions) {
        const s = rec(session);
        const slug = typeof s?.language_slug === "string" ? s.language_slug : null;
        if (slug && typeof s?.lessons === "number") {
          weekLessons[slug] = (weekLessons[slug] ?? 0) + s.lessons;
        }
      }
    }
    if (row.templateKind === "espiritualidade" && Array.isArray(d.practices)) {
      for (const practice of d.practices) {
        const p = rec(practice);
        const slug = typeof p?.slug === "string" ? p.slug : null;
        if (slug) weekPractices[slug] = (weekPractices[slug] ?? 0) + 1;
      }
    }
    if (row.templateKind === "hobby") {
      hobbySessions += 1;
      if (typeof d.minutes === "number") hobbyMinutes += d.minutes;
    }
  }

  return {
    streak,
    lastDone,
    avgSleepHours: average(recentSleep.map((n) => n.hours)),
    avgRoutineBlocks: average(routineBlockCounts),
    recentSleep,
    weekLessons,
    weekPractices,
    hobbySessions,
    hobbyMinutes,
  };
}

// The first day anything was ever logged. Everything before it is outside the
// record, not a run of missed days — so it never lands in a denominator.
export async function getTrackingStart(userId: UserId): Promise<string | null> {
  const [row] = await db
    .select({ first: sql<string | null>`min(${dailyChecks.checkedAt})` })
    .from(dailyChecks)
    .where(eq(dailyChecks.userId, userId));
  return row?.first ?? null;
}

// How many routine blocks and spiritual practices are configured, so a grid
// cell can say "4/6" rather than "4". Counts every block/practice ever saved,
// active or not — the same as the old $count with no `active` filter, kept
// as-is rather than quietly tightened to "currently active" here.
async function getCellTotals(userId: UserId): Promise<CellTotals> {
  const [routine, spirituality] = await Promise.all([
    getRoutineConfig(userId),
    getSpiritualityConfig(userId),
  ]);
  return {
    routineBlocks: routine?.blocks.length ?? 0,
    practices: spirituality?.practices.length ?? 0,
  };
}

export interface MonthMatrixDay {
  date: string;
  dayOfMonth: number;
  weekday: number; // ISO 1..7
  // Inside the record: on or after the first ever check, and already past.
  // Days outside it are blanks, not misses.
  tracked: boolean;
  doneCount: number; // required habits only — the heat level
  // Per-habit outcome for the tooltip, in habit order.
  habits: { slug: string; name: string; done: boolean; value: string | null }[];
}

export interface MonthMatrix {
  month: string;
  days: MonthMatrixDay[];
  requiredCount: number;
  // Days of this month inside the record — the adherence denominator.
  countedDays: number;
}

// Every day of the month with its per-habit outcome — feeds both the calendar
// heat and the tooltip, so they can never disagree.
export async function getMonthMatrix(
  userId: UserId,
  month: string
): Promise<MonthMatrix> {
  const total = daysInMonth(month);
  const first = `${month}-01`;
  const last = `${month}-${String(total).padStart(2, "0")}`;

  const today = todayInSaoPaulo();
  const [allHabits, rows, totals, trackingStart] = await Promise.all([
    db
      .select(habitListColumns)
      .from(habits)
      .leftJoin(lifeDomains, eq(habits.domainId, lifeDomains.id))
      .where(habitsForRange(userId, first, last))
      .orderBy(asc(habits.position), asc(habits.id)),
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
          eq(dailyChecks.userId, userId),
          gte(dailyChecks.checkedAt, first),
          lte(dailyChecks.checkedAt, last)
        )
      ),
    getCellTotals(userId),
    getTrackingStart(userId),
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
        value:
          cellValue(h.templateKind, entry?.details, done, totals, h.target)
            ?.label ?? null,
        optional: h.optional,
      };
    });
    return {
      date,
      dayOfMonth: i + 1,
      weekday: isoWeekday(date),
      tracked: date <= today && (!trackingStart || date >= trackingStart),
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
    countedDays: countTrackedDays(first, last, today, trackingStart),
  };
}

// Done-days per habit for a month — used for the consistency panel's
// "vs. previous month" delta.
export async function getMonthDoneCounts(
  userId: UserId,
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
        eq(dailyChecks.userId, userId),
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
  userId: UserId,
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
        eq(dailyChecks.userId, userId),
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
export async function getWeekData(
  userId: UserId,
  start: string
): Promise<WeekData> {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = todayInSaoPaulo();
  // Details come along so each cell can carry its own figure ("9 pg", "4/6")
  // instead of a bare tick.
  const [allHabits, rows, totals, trackingStart] = await Promise.all([
    db
      .select(habitListColumns)
      .from(habits)
      .leftJoin(lifeDomains, eq(habits.domainId, lifeDomains.id))
      .where(habitsForRange(userId, start, days[6]))
      .orderBy(asc(habits.position), asc(habits.id)),
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
          eq(dailyChecks.userId, userId),
          gte(dailyChecks.checkedAt, start),
          lte(dailyChecks.checkedAt, days[6])
        )
      ),
    getCellTotals(userId),
    getTrackingStart(userId),
  ]);

  // Only days that have happened AND are inside the record count towards the
  // percentage: a habit kept on all three days so far reads 100%, not 43%.
  const countedDays = countTrackedDays(days[0], days[6], today, trackingStart);

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
      const value = cellValue(
        h.templateKind,
        entry?.details,
        done,
        totals,
        h.target
      );
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
      templateKind: h.templateKind,
      domainSlug: h.domainSlug,
      done: cells.map((c) => c.done),
      cells,
      percent:
        countedDays === 0 ? 0 : Math.round((doneCount / countedDays) * 100),
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

  return {
    start,
    days,
    habits: habitRows,
    countedDays,
    // A day the record doesn't cover yet has nothing to report.
    tracked: days.map(
      (d) => d <= today && (!trackingStart || d >= trackingStart)
    ),
    bestSlug,
    worstSlug,
  };
}

// Adherence % (README Decision 5) + current streak (Decision 4) per habit.
// The streak is always the CURRENT streak, so it reads from all done rows up
// to today regardless of which month is being viewed — fine at this scale
// (7 habits, one row per habit per day).
export async function getMonthData(
  userId: UserId,
  month: string,
  today: string
): Promise<MonthData> {
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const [allHabits, monthRows, streakRows, trackingStart] = await Promise.all([
    db
      .select(habitListColumns)
      .from(habits)
      .leftJoin(lifeDomains, eq(habits.domainId, lifeDomains.id))
      .where(habitsForRange(userId, first, last))
      .orderBy(asc(habits.position), asc(habits.id)),
    db
      .select({ habitId: dailyChecks.habitId, checkedAt: dailyChecks.checkedAt })
      .from(dailyChecks)
      .where(
        and(
          eq(dailyChecks.userId, userId),
          gte(dailyChecks.checkedAt, first),
          lte(dailyChecks.checkedAt, last),
          eq(dailyChecks.done, true)
        )
      ),
    db
      .select({ habitId: dailyChecks.habitId, checkedAt: dailyChecks.checkedAt })
      .from(dailyChecks)
      .where(
        and(
          eq(dailyChecks.userId, userId),
          eq(dailyChecks.done, true),
          lte(dailyChecks.checkedAt, today)
        )
      ),
    getTrackingStart(userId),
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
      doneInMonth.get(h.id) ?? 0,
      trackingStart
    );
    return {
      habitId: h.id,
      name: h.name,
      slug: h.slug,
      optional: h.optional,
      templateKind: h.templateKind,
      domainSlug: h.domainSlug,
      ...adherence,
      streak: calcStreak(doneDatesByHabit.get(h.id) ?? new Set(), today),
    };
  });

  return { month, habits: stats };
}
