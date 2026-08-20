// Single data-access layer: the ONLY file (besides seed.ts) that touches
// Drizzle. Routes validate input and call these functions; business math is
// delegated to the pure helpers in src/lib/utils.ts.
//
// The grain is the ACTIVITY, not the habit — see
// docs/HABIT-VS-ACTIVITY-MODEL.md. daily_checks.activity_id is the spine;
// habits are read only for the umbrella fields (name, optional, domainSlug)
// a card or row needs to group and label itself by.
import { and, asc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "./index";
import { activitiesFor, activitiesForRange, type UserId } from "./scope";
import { activities, dailyChecks, habits, lifeDomains } from "./schema";
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
import type {
  DuolingoConfig,
  ReadingConfig,
  RoutineConfig,
  SleepConfig,
  SpiritualityConfig,
  WorkoutConfig,
} from "@/lib/config-schemas";
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
import {
  EMPTY_ACTIVITY_CONTEXT,
  type ActivityContext,
  type CheckWithActivity,
  type MonthActivityStats,
  type MonthData,
  type TodayContext,
  type WeekActivityRow,
  type WeekCell,
  type WeekData,
} from "@/types/habit";

// The activity fields the week grid and month view need, plus the umbrella
// habit's own name/optional/domain — a left join on lifeDomains, so an
// unanchored habit's activities still appear.
const activityListColumns = {
  id: activities.id,
  name: activities.name,
  slug: activities.slug,
  habitId: activities.habitId,
  habitName: habits.name,
  optional: habits.optional,
  templateKind: activities.templateKind,
  target: activities.target,
  config: activities.config,
  domainSlug: lifeDomains.slug,
};

const checkWithActivityColumns = {
  id: dailyChecks.id,
  activityId: dailyChecks.activityId,
  checkedAt: dailyChecks.checkedAt,
  done: dailyChecks.done,
  details: dailyChecks.details,
  note: dailyChecks.note,
  name: activities.name,
  slug: activities.slug,
  habitId: activities.habitId,
  habitName: habits.name,
  optional: habits.optional,
  // The renderers key on templateKind, which now lives on the activity.
  templateKind: activities.templateKind,
  metricType: activities.metricType,
  unit: activities.unit,
  target: activities.target,
  minimalAction: activities.minimalAction,
  // Template-kind-specific setup (today: the checklist kind's item labels).
  config: activities.config,
  // The life area, for the icon a plain activity falls back to. Left-joined,
  // so a habit added before any assessment simply has none.
  domainSlug: lifeDomains.slug,
};

function selectChecks() {
  return db
    .select(checkWithActivityColumns)
    .from(dailyChecks)
    .innerJoin(activities, eq(dailyChecks.activityId, activities.id))
    .innerJoin(habits, eq(activities.habitId, habits.id))
    .leftJoin(lifeDomains, eq(habits.domainId, lifeDomains.id));
}

// Fetch the day's checks, lazily creating the missing ones. The multi-row
// INSERT is a single atomic statement and ON CONFLICT DO NOTHING leans on the
// UNIQUE(activity_id, checked_at) constraint, so concurrent first-loads of
// the same day are safe (the neon-http driver has no interactive
// transactions).
export async function getDayChecks(
  userId: UserId,
  date: string
): Promise<CheckWithActivity[]> {
  // Scoped to the owner AND to the day: activitiesFor() excludes activities
  // (or their parent habit) that were removed before this date, ones that
  // started after it, and proposals never accepted. Without the window this
  // would keep materialising checks for a removed activity forever.
  const liveActivities = await db
    .select({ id: activities.id })
    .from(activities)
    .innerJoin(habits, eq(activities.habitId, habits.id))
    .where(activitiesFor(userId, date))
    .orderBy(asc(habits.position), asc(activities.position), asc(activities.id));
  if (liveActivities.length > 0) {
    await db
      .insert(dailyChecks)
      .values(liveActivities.map((a) => ({ userId, activityId: a.id, checkedAt: date })))
      .onConflictDoNothing();
  }
  // The read is scoped again rather than trusting the insert above: a check
  // written on a day the activity was still live must not resurface after
  // the activity (or its habit) is removed.
  return selectChecks()
    .where(
      and(
        eq(dailyChecks.userId, userId),
        eq(dailyChecks.checkedAt, date),
        activitiesFor(userId, date)
      )
    )
    .orderBy(asc(habits.position), asc(activities.position), asc(activities.id));
}

// Every id-addressed write carries the user in its WHERE clause: an id from
// somebody else's account simply matches no row, rather than being mutated.
export async function toggleCheck(
  userId: UserId,
  id: number,
  done: boolean
): Promise<CheckWithActivity | null> {
  const [updated] = await db
    .update(dailyChecks)
    .set({ done, updatedAt: new Date() })
    .where(and(eq(dailyChecks.id, id), eq(dailyChecks.userId, userId)))
    .returning({ id: dailyChecks.id });
  if (!updated) return null;
  const [row] = await selectChecks().where(eq(dailyChecks.id, updated.id));
  return row ?? null;
}

const RICH_KINDS_WITH_CONTEXT = [
  "treino",
  "leitura",
  "sono",
  "rotina",
  "duolingo",
  "espiritualidade",
] as const;

function emptyActivityContext(): ActivityContext {
  // A fresh copy every call — the loop below mutates its own fields as each
  // kind resolves. Arrays are replaced wholesale, never pushed into, so
  // starting from the shared empty ones is safe.
  return { ...EMPTY_ACTIVITY_CONTEXT };
}

// Everything the Today detail sheets need, resolved for the given day, per
// ACTIVITY — see docs/HABIT-VS-ACTIVITY-MODEL.md. More than one activity can
// share a kind now, so this can no longer be "the account's one workout
// plan"; it's every live rich-kind activity's own resolved context, keyed by
// its own id. Reuses rich-habits.ts's typed per-kind getters rather than
// re-deriving their shaping logic here.
export async function getTodayContext(
  userId: UserId,
  date: string
): Promise<TodayContext> {
  const weekday = isoWeekday(date);
  const rows = await db
    .select({ id: activities.id, templateKind: activities.templateKind })
    .from(activities)
    .innerJoin(habits, eq(activities.habitId, habits.id))
    .where(
      and(
        activitiesFor(userId, date),
        inArray(activities.templateKind, [...RICH_KINDS_WITH_CONTEXT])
      )
    );

  const entries = await Promise.all(
    rows.map(async (row): Promise<[number, ActivityContext]> => {
      const ctx = emptyActivityContext();
      switch (row.templateKind) {
        case "treino": {
          const workout = await getWorkoutConfig(userId, row.id);
          if (workout) {
            // Only the active days are "the current plan" — a retired day
            // (superseded by a later save) stays in config for old
            // check-ins to resolve, but Today has no business scheduling
            // against it.
            const planDays = workout.days
              .filter((d) => d.active)
              .map((d) => ({
                id: d.id,
                weekday: d.weekday,
                focus: d.focus,
                exercises: d.exercises,
              }));
            ctx.plan = {
              name: workout.planName,
              day: planDays.find((d) => d.weekday === weekday) ?? null,
              days: planDays,
            };
          }
          break;
        }
        case "leitura": {
          const [book, allBooks] = await Promise.all([
            getCurrentBook(userId, row.id),
            listBooks(userId, row.id),
          ]);
          if (book) {
            ctx.book = {
              id: book.id,
              title: book.title,
              totalPages: book.totalPages,
              currentPage: book.currentPage,
              // What comes after this one, in reading order.
              queue: allBooks
                .filter((b) => b.id !== book.id && b.status === "queued")
                .map((b) => ({ title: b.title, totalPages: b.totalPages })),
            };
          }
          break;
        }
        case "sono": {
          const sleep = await getSleepConfig(userId, row.id);
          if (sleep) ctx.sleepTarget = { bedtime: sleep.bedtime, wakeTime: sleep.wakeTime };
          break;
        }
        case "rotina": {
          // Active, regardless of weekday — routineBlockCount needs the
          // unfiltered active count; routineBlocks needs it filtered to
          // today. See ActivityContext's own comment on why both travel.
          const active = await listRoutineBlocks(userId, row.id, true);
          ctx.routineBlocks = active
            .filter((b) => b.weekdays.includes(weekday))
            .map((b) => ({
              id: b.id,
              startTime: b.startTime,
              endTime: b.endTime,
              activity: b.activity,
            }));
          ctx.routineBlockCount = active.length;
          break;
        }
        case "duolingo": {
          const langs = await listLanguages(userId, row.id, true);
          ctx.languages = langs.map((l) => ({ slug: l.slug, name: l.name }));
          break;
        }
        case "espiritualidade": {
          const practices = await listSpiritualPractices(userId, row.id, true);
          ctx.practices = practices.map((p) => ({
            slug: p.slug,
            name: p.name,
            countable: p.countable,
          }));
          break;
        }
      }
      return [row.id, ctx];
    })
  );

  return { weekday, activities: Object.fromEntries(entries) };
}

// When a reading detail is saved, advance the book's current_page and flip it
// to "done" if the last page was reached (spec: mark finished → next book).
export async function applyReadingProgress(
  userId: UserId,
  activityId: number,
  bookId: number,
  endedOnPage: number,
  date: string
) {
  const book = await getBookById(userId, activityId, bookId);
  if (!book) return;
  const patch: Parameters<typeof updateBook>[3] = {
    currentPage: Math.max(book.currentPage, endedOnPage),
  };
  if (!book.startedAt) patch.startedAt = date;
  if (endedOnPage >= book.totalPages) {
    patch.status = "done";
    patch.finishedAt = date;
  } else if (book.status === "queued") {
    patch.status = "reading";
  }
  await updateBook(userId, activityId, bookId, patch);
}

// What the API needs about a check's activity before it can validate
// incoming details: the template kind picks the Zod schema, and the reading
// side-effect keys on it too. Null for a check that isn't yours.
export async function getCheckTemplateKind(
  userId: UserId,
  id: number
): Promise<{ templateKind: string | null; activityId: number } | null> {
  const [row] = await db
    .select({ templateKind: activities.templateKind, activityId: activities.id })
    .from(dailyChecks)
    .innerJoin(activities, eq(dailyChecks.activityId, activities.id))
    .where(and(eq(dailyChecks.id, id), eq(dailyChecks.userId, userId)));
  return row ?? null;
}

// Per-activity save from the Today sheet: details (already Zod-validated at
// the API layer) + note + done, in one write.
export async function saveCheckDetails(
  userId: UserId,
  id: number,
  input: { done: boolean; details?: unknown; note?: string | null }
): Promise<CheckWithActivity | null> {
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
  const [row] = await selectChecks().where(eq(dailyChecks.id, id));
  return row ?? null;
}

// Canonical dataset export for a date range — the exact payload a future AI
// analysis consumes (see docs/DATA_DICTIONARY.md). Entities are now arrays of
// per-ACTIVITY setup, each tagged with the activity's own slug so a day's
// entry can be correlated back to the right one — more than one activity of
// a kind is now possible. Days hold per-activity {done, details, note},
// keyed by activity slug.
const EXPORT_RICH_KINDS = [
  "treino",
  "leitura",
  "rotina",
  "duolingo",
  "espiritualidade",
  "sono",
] as const;

export async function getExport(userId: UserId, from: string, to: string) {
  const [richActivities, checkRows] = await Promise.all([
    db
      .select({
        id: activities.id,
        slug: activities.slug,
        templateKind: activities.templateKind,
        config: activities.config,
      })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          inArray(activities.templateKind, [...EXPORT_RICH_KINDS])
        )
      ),
    db
      .select({
        date: dailyChecks.checkedAt,
        slug: activities.slug,
        done: dailyChecks.done,
        details: dailyChecks.details,
        note: dailyChecks.note,
      })
      .from(dailyChecks)
      .innerJoin(activities, eq(dailyChecks.activityId, activities.id))
      .where(
        and(
          eq(dailyChecks.userId, userId),
          gte(dailyChecks.checkedAt, from),
          lte(dailyChecks.checkedAt, to)
        )
      )
      .orderBy(asc(dailyChecks.checkedAt), asc(activities.id)),
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

  const workouts = richActivities.filter((a) => a.templateKind === "treino");
  const readings = richActivities.filter((a) => a.templateKind === "leitura");
  const routines = richActivities.filter((a) => a.templateKind === "rotina");
  const spiritualities = richActivities.filter((a) => a.templateKind === "espiritualidade");
  const duolingos = richActivities.filter((a) => a.templateKind === "duolingo");
  const sleeps = richActivities.filter((a) => a.templateKind === "sono");

  // Emit snake_case throughout so the whole export is self-consistent with
  // the `details` fields and docs/DATA_DICTIONARY.md. schema_version bumped
  // 3 → 4: entities moved from "one per account" to "one per activity",
  // each now carrying its own `activity_slug`, and `days[].habits` renamed
  // `days[].activities` — see docs/HABIT-VS-ACTIVITY-MODEL.md.
  return {
    meta: { from, to, timezone: "America/Sao_Paulo", schema_version: 4 },
    entities: {
      workout_plans: workouts.map((w) => {
        const cfg = (w.config as WorkoutConfig | null) ?? { planName: "", days: [] };
        return {
          activity_slug: w.slug,
          name: cfg.planName,
          days: cfg.days.map((d) => ({
            id: d.id,
            weekday: d.weekday,
            focus: d.focus,
            exercises: d.exercises,
            active: d.active,
          })),
        };
      }),
      books: readings.flatMap((r) => {
        const cfg = (r.config as ReadingConfig | null) ?? {
          year: 0,
          targetBooksPerYear: 0,
          books: [],
        };
        return cfg.books.map((b) => ({
          activity_slug: r.slug,
          id: b.id,
          title: b.title,
          author: b.author,
          total_pages: b.totalPages,
          status: b.status,
          current_page: b.currentPage,
          position: b.position,
          started_at: b.startedAt,
          finished_at: b.finishedAt,
        }));
      }),
      reading_goals: readings.flatMap((r) => {
        const cfg = r.config as ReadingConfig | null;
        return cfg && cfg.targetBooksPerYear
          ? [{ activity_slug: r.slug, year: cfg.year, target_books: cfg.targetBooksPerYear }]
          : [];
      }),
      routine_blocks: routines.flatMap((r) => {
        const cfg = (r.config as RoutineConfig | null) ?? { blocks: [] };
        return cfg.blocks.map((b) => ({
          activity_slug: r.slug,
          id: b.id,
          start_time: b.startTime,
          end_time: b.endTime,
          activity: b.activity,
          weekdays: b.weekdays,
          active: b.active,
          position: b.position,
        }));
      }),
      spiritual_practices: spiritualities.flatMap((s) => {
        const cfg = (s.config as SpiritualityConfig | null) ?? { practices: [] };
        return cfg.practices.map((p) => ({
          activity_slug: s.slug,
          name: p.name,
          slug: p.slug,
          countable: p.countable,
          active: p.active,
          position: p.position,
        }));
      }),
      languages: duolingos.flatMap((d) => {
        const cfg = (d.config as DuolingoConfig | null) ?? { languages: [] };
        return cfg.languages.map((l) => ({
          activity_slug: d.slug,
          name: l.name,
          slug: l.slug,
          active: l.active,
        }));
      }),
      sleep_targets: sleeps.flatMap((s) => {
        const cfg = s.config as SleepConfig | null;
        return cfg
          ? [{ activity_slug: s.slug, bedtime: cfg.bedtime, wake_time: cfg.wakeTime }]
          : [];
      }),
    },
    days: [...daysMap.entries()].map(([date, activitiesForDay]) => ({
      date,
      activities: activitiesForDay,
    })),
  };
}

// Nested by activityId: an id like plan_day_id or book_id is only unique
// WITHIN one activity's own config now that two activities of a kind can
// coexist (see docs/HABIT-VS-ACTIVITY-MODEL.md) — a flat, account-wide map
// would collide across them the moment an account has two.
export interface AuditLookup {
  books: Record<number, string>;
  planDays: Record<number, string>;
  // plan_day_id → exercise name → "3×8" (empty when the plan omits sets/reps)
  planExercises: Record<number, Record<string, string>>;
  blocks: Record<number, string>;
  languages: Record<string, string>;
  practices: Record<string, string>;
}

export type AuditLookups = Record<number, AuditLookup>;

// Id/slug → display-name maps so the Day Audit can render details
// human-readably (book title, plan focus, block activity, language/practice
// names), one bundle per activity. Includes inactive rows so historical
// references still resolve.
export async function getAuditLookups(userId: UserId): Promise<AuditLookups> {
  const richActivities = await db
    .select({
      id: activities.id,
      templateKind: activities.templateKind,
      config: activities.config,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        inArray(activities.templateKind, [...EXPORT_RICH_KINDS])
      )
    );

  const out: AuditLookups = {};
  for (const a of richActivities) {
    if (a.templateKind === "leitura") {
      const cfg = (a.config as ReadingConfig | null) ?? { books: [], year: 0, targetBooksPerYear: 0 };
      out[a.id] = {
        books: Object.fromEntries(cfg.books.map((b) => [b.id, b.title])),
        planDays: {},
        planExercises: {},
        blocks: {},
        languages: {},
        practices: {},
      };
    } else if (a.templateKind === "treino") {
      const cfg = (a.config as WorkoutConfig | null) ?? { planName: "", days: [] };
      out[a.id] = {
        books: {},
        planDays: Object.fromEntries(cfg.days.map((d) => [d.id, d.focus])),
        planExercises: Object.fromEntries(
          cfg.days.map((d) => [
            d.id,
            Object.fromEntries(d.exercises.map((e) => [e.name, exerciseScheme(e)])),
          ])
        ),
        blocks: {},
        languages: {},
        practices: {},
      };
    } else if (a.templateKind === "rotina") {
      const cfg = (a.config as RoutineConfig | null) ?? { blocks: [] };
      out[a.id] = {
        books: {},
        planDays: {},
        planExercises: {},
        blocks: Object.fromEntries(cfg.blocks.map((b) => [b.id, b.activity])),
        languages: {},
        practices: {},
      };
    } else if (a.templateKind === "duolingo") {
      const cfg = (a.config as DuolingoConfig | null) ?? { languages: [] };
      out[a.id] = {
        books: {},
        planDays: {},
        planExercises: {},
        blocks: {},
        languages: Object.fromEntries(cfg.languages.map((l) => [l.slug, l.name])),
        practices: {},
      };
    } else if (a.templateKind === "espiritualidade") {
      const cfg = (a.config as SpiritualityConfig | null) ?? { practices: [] };
      out[a.id] = {
        books: {},
        planDays: {},
        planExercises: {},
        blocks: {},
        languages: {},
        practices: Object.fromEntries(cfg.practices.map((p) => [p.slug, p.name])),
      };
    }
  }
  return out;
}

// Read-only day fetch for the Day Audit (never lazily creates rows, unlike
// getDayChecks — a past day being viewed shouldn't materialize empty checks).
export function getDayChecksReadonly(
  userId: UserId,
  date: string
): Promise<CheckWithActivity[]> {
  // Scoped to the day being audited, so an activity removed last month
  // doesn't reappear in the record of a day it was still being tracked on —
  // and, more importantly, so this can never read across accounts.
  return selectChecks()
    .where(
      and(
        eq(dailyChecks.userId, userId),
        eq(dailyChecks.checkedAt, date),
        activitiesFor(userId, date)
      )
    )
    .orderBy(asc(habits.position), asc(activities.position), asc(activities.id));
}

// Consecutive days where every required activity was done — the same rule as
// an activity streak (count back from yesterday, +1 if today already
// qualifies), so an unfinished today never zeroes it. Bounded to a window; a
// streak longer than that is beyond what this screen needs to say.
const STREAK_WINDOW_DAYS = 180;

export async function getDayStreak(
  userId: UserId,
  today: string
): Promise<number> {
  // Counts THIS user's currently-tracked required activities (an optional
  // habit's activities never penalize).
  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(activities)
    .innerJoin(habits, eq(activities.habitId, habits.id))
    .where(and(activitiesFor(userId, today), eq(habits.optional, false)));
  const requiredCount = countRow?.n ?? 0;
  if (requiredCount === 0) return 0;

  const rows = await db
    .select({
      date: dailyChecks.checkedAt,
      done: sql<number>`count(*)`.as("done"),
    })
    .from(dailyChecks)
    .innerJoin(activities, eq(dailyChecks.activityId, activities.id))
    .innerJoin(habits, eq(activities.habitId, habits.id))
    .where(
      and(
        eq(dailyChecks.userId, userId),
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

// The one line of "how does today compare" each Today card is allowed to make.
// Relative days only, never clock times: `created_at` exists but a row written
// at 00:30 or edited a week later would misreport when the thing happened.
export interface TodayComparisons {
  streak: Record<string, number>; // per activity slug, current run of done days
  lastDone: Record<string, string>; // per activity slug, last done day before today
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

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export async function getTodayComparisons(
  userId: UserId,
  today: string
): Promise<TodayComparisons> {
  const [doneRows, recentRows] = await Promise.all([
    db
      .select({ slug: activities.slug, date: dailyChecks.checkedAt })
      .from(dailyChecks)
      .innerJoin(activities, eq(dailyChecks.activityId, activities.id))
      .where(
        and(
          eq(dailyChecks.userId, userId),
          eq(dailyChecks.done, true),
          gte(dailyChecks.checkedAt, addDays(today, -STREAK_WINDOW_DAYS)),
          lte(dailyChecks.checkedAt, today)
        )
      ),
    // Filtered by templateKind, not slug: a slug is per-account free text
    // (two activities can each be slugged "sono" without either being a
    // sleep activity at all), so matching on it here would silently mix up
    // whose comparisons are whose the moment slugs diverge from kind.
    db
      .select({
        templateKind: activities.templateKind,
        date: dailyChecks.checkedAt,
        details: dailyChecks.details,
      })
      .from(dailyChecks)
      .innerJoin(activities, eq(dailyChecks.activityId, activities.id))
      .where(
        and(
          eq(dailyChecks.userId, userId),
          eq(dailyChecks.done, true),
          inArray(activities.templateKind, [
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

// Configured sizes cellValue's "4/6" labels need, computed straight from the
// ROW's OWN config (already selected by activityListColumns) rather than a
// separate account-wide round trip — now that a routine/spirituality
// activity's totals genuinely belong to that one activity, not the account.
// Counts every block/practice ever saved, active or not, matching the old
// $count semantics exactly.
function cellTotalsFor(templateKind: string | null, config: unknown): CellTotals {
  if (templateKind === "rotina") {
    const blocks = (config as RoutineConfig | null)?.blocks ?? [];
    return { routineBlocks: blocks.length };
  }
  if (templateKind === "espiritualidade") {
    const practices = (config as SpiritualityConfig | null)?.practices ?? [];
    return { practices: practices.length };
  }
  return {};
}

export interface MonthMatrixDay {
  date: string;
  dayOfMonth: number;
  weekday: number; // ISO 1..7
  // Inside the record: on or after the first ever check, and already past.
  // Days outside it are blanks, not misses.
  tracked: boolean;
  doneCount: number; // required activities only — the heat level
  // Per-activity outcome for the tooltip, in activity order.
  activities: { slug: string; name: string; done: boolean; value: string | null }[];
}

export interface MonthMatrix {
  month: string;
  days: MonthMatrixDay[];
  requiredCount: number;
  // Days of this month inside the record — the adherence denominator.
  countedDays: number;
}

// Every day of the month with its per-activity outcome — feeds both the
// calendar heat and the tooltip, so they can never disagree.
export async function getMonthMatrix(
  userId: UserId,
  month: string
): Promise<MonthMatrix> {
  const total = daysInMonth(month);
  const first = `${month}-01`;
  const last = `${month}-${String(total).padStart(2, "0")}`;

  const today = todayInSaoPaulo();
  const [allActivities, rows, trackingStart] = await Promise.all([
    db
      .select(activityListColumns)
      .from(activities)
      .innerJoin(habits, eq(activities.habitId, habits.id))
      .leftJoin(lifeDomains, eq(habits.domainId, lifeDomains.id))
      .where(activitiesForRange(userId, first, last))
      .orderBy(asc(habits.position), asc(activities.position), asc(activities.id)),
    db
      .select({
        activityId: dailyChecks.activityId,
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
    getTrackingStart(userId),
  ]);

  const byActivityDay = new Map<string, { done: boolean; details: unknown }>();
  for (const row of rows) {
    byActivityDay.set(`${row.activityId}:${row.checkedAt}`, {
      done: row.done,
      details: row.details,
    });
  }

  const days: MonthMatrixDay[] = Array.from({ length: total }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const perActivity = allActivities.map((a) => {
      const entry = byActivityDay.get(`${a.id}:${date}`);
      const done = entry?.done ?? false;
      return {
        slug: a.slug,
        name: a.name,
        done,
        value:
          cellValue(
            a.templateKind,
            entry?.details,
            done,
            cellTotalsFor(a.templateKind, a.config),
            a.target
          )?.label ?? null,
        optional: a.optional,
      };
    });
    return {
      date,
      dayOfMonth: i + 1,
      weekday: isoWeekday(date),
      tracked: date <= today && (!trackingStart || date >= trackingStart),
      doneCount: perActivity.filter((p) => p.done && !p.optional).length,
      activities: perActivity.map(({ slug, name, done, value }) => ({
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
    requiredCount: allActivities.filter((a) => !a.optional).length,
    countedDays: countTrackedDays(first, last, today, trackingStart),
  };
}

// Done-days per activity for a month — used for the consistency panel's
// "vs. previous month" delta.
export async function getMonthDoneCounts(
  userId: UserId,
  month: string
): Promise<Record<string, number>> {
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const rows = await db
    .select({ slug: activities.slug, count: sql<number>`count(*)`.as("count") })
    .from(dailyChecks)
    .innerJoin(activities, eq(dailyChecks.activityId, activities.id))
    .where(
      and(
        eq(dailyChecks.userId, userId),
        eq(dailyChecks.done, true),
        gte(dailyChecks.checkedAt, first),
        lte(dailyChecks.checkedAt, last)
      )
    )
    .groupBy(activities.slug);
  return Object.fromEntries(rows.map((r) => [r.slug, Number(r.count)]));
}

export interface MonthDetailStats {
  sleep: { avgHours: number | null; nights: number };
  reading: { totalPages: number };
  workout: { percent: number; days: number };
  duolingo: { total: number; perLanguage: { slug: string; lessons: number }[] };
  spirituality: { totalCheckins: number };
}

// Per-area rich summaries for the month view, aggregated from the JSONB details
// in JS (simpler than JSONB SQL at this scale). Switches on templateKind, not
// slug — slugs are per-account free text, so keying on one here would mix up
// whose numbers were whose the moment two accounts (or two activities) slug
// differently from their kind.
export async function getMonthDetailStats(
  userId: UserId,
  month: string
): Promise<MonthDetailStats> {
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const rows = await db
    .select({ templateKind: activities.templateKind, details: dailyChecks.details })
    .from(dailyChecks)
    .innerJoin(activities, eq(dailyChecks.activityId, activities.id))
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
    switch (row.templateKind) {
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

// 7 days × N activities starting at a Monday. Days with no row simply count
// as not done — the week view never creates rows.
export async function getWeekData(
  userId: UserId,
  start: string
): Promise<WeekData> {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = todayInSaoPaulo();
  // Details come along so each cell can carry its own figure ("9 pg", "4/6")
  // instead of a bare tick.
  const [allActivities, rows, trackingStart] = await Promise.all([
    db
      .select(activityListColumns)
      .from(activities)
      .innerJoin(habits, eq(activities.habitId, habits.id))
      .leftJoin(lifeDomains, eq(habits.domainId, lifeDomains.id))
      .where(activitiesForRange(userId, start, days[6]))
      .orderBy(asc(habits.position), asc(activities.position), asc(activities.id)),
    db
      .select({
        activityId: dailyChecks.activityId,
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
    getTrackingStart(userId),
  ]);

  // Only days that have happened AND are inside the record count towards the
  // percentage: an activity kept on all three days so far reads 100%, not 43%.
  const countedDays = countTrackedDays(days[0], days[6], today, trackingStart);

  const byActivityDay = new Map<string, { done: boolean; details: unknown }>();
  for (const row of rows) {
    byActivityDay.set(`${row.activityId}:${row.checkedAt}`, {
      done: row.done,
      details: row.details,
    });
  }

  const activityRows: WeekActivityRow[] = allActivities.map((a) => {
    const totals = cellTotalsFor(a.templateKind, a.config);
    const cells: WeekCell[] = days.map((day) => {
      const entry = byActivityDay.get(`${a.id}:${day}`);
      const done = entry?.done ?? false;
      const value = cellValue(a.templateKind, entry?.details, done, totals, a.target);
      return {
        done,
        value: value?.label ?? null,
        partial: done && (value?.partial ?? false),
      };
    });
    const doneCount = cells.filter((c) => c.done).length;
    return {
      activityId: a.id,
      name: a.name,
      slug: a.slug,
      habitId: a.habitId,
      habitName: a.habitName,
      optional: a.optional,
      templateKind: a.templateKind,
      domainSlug: a.domainSlug,
      done: cells.map((c) => c.done),
      cells,
      percent:
        countedDays === 0 ? 0 : Math.round((doneCount / countedDays) * 100),
    };
  });

  // Best/worst of the week among REQUIRED activities only (README Decision
  // 6); null when nothing was checked in the week at all.
  const required = activityRows.filter((a) => !a.optional);
  const counts = required.map((a) => a.done.filter(Boolean).length);
  let bestSlug: string | null = null;
  let worstSlug: string | null = null;
  if (counts.some((c) => c > 0)) {
    bestSlug = required[counts.indexOf(Math.max(...counts))].slug;
    worstSlug = required[counts.indexOf(Math.min(...counts))].slug;
  }

  return {
    start,
    days,
    activities: activityRows,
    countedDays,
    // A day the record doesn't cover yet has nothing to report.
    tracked: days.map(
      (d) => d <= today && (!trackingStart || d >= trackingStart)
    ),
    bestSlug,
    worstSlug,
  };
}

// Adherence % (README Decision 5) + current streak (Decision 4) per activity.
// The streak is always the CURRENT streak, so it reads from all done rows up
// to today regardless of which month is being viewed.
export async function getMonthData(
  userId: UserId,
  month: string,
  today: string
): Promise<MonthData> {
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const [allActivities, monthRows, streakRows, trackingStart] = await Promise.all([
    db
      .select(activityListColumns)
      .from(activities)
      .innerJoin(habits, eq(activities.habitId, habits.id))
      .leftJoin(lifeDomains, eq(habits.domainId, lifeDomains.id))
      .where(activitiesForRange(userId, first, last))
      .orderBy(asc(habits.position), asc(activities.position), asc(activities.id)),
    db
      .select({ activityId: dailyChecks.activityId, checkedAt: dailyChecks.checkedAt })
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
      .select({ activityId: dailyChecks.activityId, checkedAt: dailyChecks.checkedAt })
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
    doneInMonth.set(row.activityId, (doneInMonth.get(row.activityId) ?? 0) + 1);
  }
  const doneDatesByActivity = new Map<number, Set<string>>();
  for (const row of streakRows) {
    const set = doneDatesByActivity.get(row.activityId) ?? new Set<string>();
    set.add(row.checkedAt);
    doneDatesByActivity.set(row.activityId, set);
  }

  const stats: MonthActivityStats[] = allActivities.map((a) => {
    const adherence = calcMonthAdherence(
      month,
      today,
      doneInMonth.get(a.id) ?? 0,
      trackingStart
    );
    return {
      activityId: a.id,
      name: a.name,
      slug: a.slug,
      habitId: a.habitId,
      habitName: a.habitName,
      optional: a.optional,
      templateKind: a.templateKind,
      domainSlug: a.domainSlug,
      ...adherence,
      streak: calcStreak(doneDatesByActivity.get(a.id) ?? new Set(), today),
    };
  });

  return { month, activities: stats };
}
