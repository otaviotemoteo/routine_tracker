import type { MetricType, PlannedExercise } from "@/db/schema";

export interface Habit {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  optional: boolean;
}

// Everything the per-activity detail sheets need to render their forms with
// the user's configured entities. Plain serializable data (crosses to the
// client).
export interface PlanDay {
  id: number;
  weekday: number;
  focus: string;
  exercises: PlannedExercise[];
}

// One rich-kind ACTIVITY's own resolved context for a given day — what used
// to be the whole of TodayContext, back when there was exactly one workout
// habit, one reading habit, etc. per account. Now there can be more than
// one activity of a kind, so this lives per-activity, not per-account.
export interface ActivityContext {
  plan: {
    name: string;
    // Today's planned day (null on a rest day), plus every day of the plan so
    // the daily flow can log a different training than the one scheduled.
    day: PlanDay | null;
    days: PlanDay[];
  } | null;
  book: {
    id: number;
    title: string;
    totalPages: number;
    currentPage: number;
    // Still-queued books, in reading order.
    queue: { title: string; totalPages: number }[];
  } | null;
  sleepTarget: { bedtime: string; wakeTime: string } | null;
  routineBlocks: {
    id: number;
    startTime: string;
    endTime: string;
    activity: string;
  }[];
  // Active blocks regardless of weekday — routineBlocks above is already
  // filtered to today, which loses the one signal that tells "never
  // configured" apart from "configured, nothing scheduled today". See
  // today-card.ts / card-status.ts's rotina branches.
  routineBlockCount: number;
  languages: { slug: string; name: string }[];
  practices: { slug: string; name: string; countable: boolean }[];
}

export interface TodayContext {
  weekday: number; // ISO 1..7 — shared; the same date for every activity
  // Keyed by activityId. Only rich-kind activities live today have an entry;
  // a plain activity's card needs none of this.
  activities: Record<number, ActivityContext>;
}

// A shared empty slice for a plain activity, or a rich one with no entry for
// this date — safe to share since nothing mutates it after construction.
export const EMPTY_ACTIVITY_CONTEXT: ActivityContext = {
  plan: null,
  book: null,
  sleepTarget: null,
  routineBlocks: [],
  routineBlockCount: 0,
  languages: [],
  practices: [],
};

// One activity's check for one day, flattened with the fields the UI needs —
// its own AND its parent habit's (for grouping/display). The grain is the
// ACTIVITY: a habit with two activities produces two of these per day. See
// docs/ARCHITECTURE.md.
export interface CheckWithActivity {
  id: number;
  activityId: number;
  checkedAt: string; // YYYY-MM-DD (São Paulo calendar day)
  done: boolean;
  // Tier 2 (v2): granular answers validated by details-schemas.ts; null when
  // the day was quick-toggled or predates v2. `note` is always-optional text.
  details: unknown;
  note: string | null;
  // The activity's own card label ("Treino", "Corrida") and per-account slug.
  name: string;
  slug: string;
  // The umbrella habit this activity belongs to — additive, for grouping
  // activities visually under their habit's name.
  habitId: number;
  habitName: string;
  // Inherited from the habit: an optional habit's activities never penalize.
  optional: boolean;
  // Which renderer this activity uses. Null is the generic one.
  templateKind: string | null;
  // The metric spine, which is what the generic renderer draws instead of
  // the per-area knowledge the seven templates have.
  metricType: MetricType;
  unit: string | null;
  target: number | null;
  minimalAction: string | null;
  // Template-kind-specific setup — see src/lib/config-schemas.ts.
  config: unknown;
  // The life area this activity's habit descends from — the icon a plain
  // activity falls back to. Null for a habit written before any values
  // check-in, rendered as not yet anchored to a value rather than an error.
  domainSlug: string | null;
}

export interface WeekCell {
  done: boolean;
  // Short label for the grid/tooltip ("9 pg", "4/6"); null when nothing was
  // logged that day.
  value: string | null;
  // Logged but short of the plan — shown in straw rather than clover.
  partial: boolean;
}

export interface WeekActivityRow {
  activityId: number;
  name: string;
  slug: string;
  habitId: number;
  habitName: string;
  optional: boolean;
  templateKind: string | null;
  domainSlug: string | null;
  // Monday-first, aligned with WeekData.days; a day with no row in the
  // database counts as not done.
  done: boolean[];
  cells: WeekCell[];
  // Share of the week's days this activity was done, 0–100.
  percent: number;
}

export interface WeekData {
  start: string; // always a Monday
  days: string[]; // 7 dates, Monday through Sunday
  activities: WeekActivityRow[];
  // Days of this week that have happened AND are on or after the first ever
  // record — the denominator, and the days worth opening a summary for.
  countedDays: number;
  tracked: boolean[];
  // Slugs of the best/worst required activity of the week (optional
  // activities are excluded per README Decision 6); null when the week has
  // no checks at all.
  bestSlug: string | null;
  worstSlug: string | null;
}

export interface MonthActivityStats {
  activityId: number;
  name: string;
  slug: string;
  habitId: number;
  habitName: string;
  optional: boolean;
  templateKind: string | null;
  domainSlug: string | null;
  doneCount: number;
  countedDays: number; // elapsed days for the current month, total for past
  percent: number;
  streak: number;
}

export interface MonthData {
  month: string; // YYYY-MM
  activities: MonthActivityStats[];
}
