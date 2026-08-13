import type { Copy, Lang } from "@/lib/i18n";
import type { CheckWithHabit, TodayContext } from "@/types/habit";

// Each per-habit sheet body reads the day's context + any existing details,
// and emits the `details` object (or null when nothing meaningful to save)
// through onChange. The HabitSheet shell owns the note, save button and PATCH.
export interface SheetBodyProps {
  context: TodayContext;
  initial: unknown;
  copy: Copy["sheets"];
  lang: Lang;
  onChange: (details: unknown) => void;
  // The habit itself. The seven original bodies ignore this — everything they
  // need is in `context`, which is built from the per-area tables. The generic
  // body has no such tables to read, so its whole form (a number, a unit, a
  // target to compare against) comes from here.
  habit: Pick<
    CheckWithHabit,
    "name" | "metricType" | "unit" | "target" | "minimalAction"
  >;
}

export const fieldClass =
  "min-h-[44px] px-3 border-2 border-forest rounded-lg bg-cream focus:bg-white";
export const labelClass = "block mb-1.5 font-semibold text-sm";

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
