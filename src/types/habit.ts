import type { MetricType, PlannedExercise } from "@/db/schema";

export interface Habit {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  optional: boolean;
}

// Everything the per-habit detail sheets need to render their forms with the
// user's configured entities. Plain serializable data (crosses to the client).
export interface PlanDay {
  id: number;
  weekday: number;
  focus: string;
  exercises: PlannedExercise[];
}

export interface TodayContext {
  weekday: number; // ISO 1..7
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
  languages: { slug: string; name: string }[];
  practices: { slug: string; name: string; countable: boolean }[];
}

// One habit's check for one day, flattened with the habit fields the UI needs.
export interface CheckWithHabit {
  id: number;
  habitId: number;
  checkedAt: string; // YYYY-MM-DD (São Paulo calendar day)
  done: boolean;
  // Tier 2 (v2): granular answers validated by details-schemas.ts; null when
  // the day was quick-toggled or predates v2. `note` is always-optional text.
  details: unknown;
  note: string | null;
  name: string;
  slug: string;
  optional: boolean;
  // Which renderer this habit uses. Null is the generic one — the normal case
  // for anything created after the remodel. The seven migrated habits carry
  // their old slug here and keep their original cards.
  templateKind: string | null;
  // The metric spine, which is what the generic renderer draws instead of the
  // per-area knowledge the seven templates have.
  metricType: MetricType;
  unit: string | null;
  target: number | null;
  minimalAction: string | null;
  // Template-kind-specific setup, filled in by the kind's own step in the
  // chooser rather than the habit form — see src/lib/templates.ts. Only the
  // `checklist` kind reads it today (`{ items: string[] }`); every other kind
  // ignores it, so it stays `unknown` rather than a kind-specific type here.
  config: unknown;
  // The life area this habit descends from — the icon a plain habit falls
  // back to. Null for a habit written before any values check-in, which is
  // rendered as not yet anchored to a value rather than as an error.
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

export interface WeekHabitRow {
  habitId: number;
  name: string;
  slug: string;
  optional: boolean;
  templateKind: string | null;
  domainSlug: string | null;
  // Monday-first, aligned with WeekData.days; a day with no row in the
  // database counts as not done.
  done: boolean[];
  cells: WeekCell[];
  // Share of the week's days this habit was done, 0–100.
  percent: number;
}

export interface WeekData {
  start: string; // always a Monday
  days: string[]; // 7 dates, Monday through Sunday
  habits: WeekHabitRow[];
  // Days of this week that have happened AND are on or after the first ever
  // record — the denominator, and the days worth opening a summary for.
  countedDays: number;
  tracked: boolean[];
  // Slugs of the best/worst required habit of the week (optional habits are
  // excluded per README Decision 6); null when the week has no checks at all.
  bestSlug: string | null;
  worstSlug: string | null;
}

export interface MonthHabitStats {
  habitId: number;
  name: string;
  slug: string;
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
  habits: MonthHabitStats[];
}
