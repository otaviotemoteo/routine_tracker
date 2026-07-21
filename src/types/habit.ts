export interface Habit {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  optional: boolean;
}

// One habit's check for one day, flattened with the habit fields the UI needs.
export interface CheckWithHabit {
  id: number;
  habitId: number;
  checkedAt: string; // YYYY-MM-DD (São Paulo calendar day)
  done: boolean;
  name: string;
  slug: string;
  optional: boolean;
}

export interface WeekHabitRow {
  habitId: number;
  name: string;
  slug: string;
  optional: boolean;
  // Monday-first, aligned with WeekData.days; a day with no row in the
  // database counts as not done.
  done: boolean[];
}

export interface WeekData {
  start: string; // always a Monday
  days: string[]; // 7 dates, Monday through Sunday
  habits: WeekHabitRow[];
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
  doneCount: number;
  countedDays: number; // elapsed days for the current month, total for past
  percent: number;
  streak: number;
}

export interface MonthData {
  month: string; // YYYY-MM
  habits: MonthHabitStats[];
}
