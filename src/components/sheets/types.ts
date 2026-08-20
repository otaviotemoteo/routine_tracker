import type { Copy, Lang } from "@/lib/i18n";
import type { ActivityContext, CheckWithActivity } from "@/types/habit";

// Each per-activity sheet body reads the day's context + any existing
// details, and emits the `details` object (or null when nothing meaningful
// to save) through onChange. The HabitSheet shell owns the note, save button
// and PATCH.
export interface SheetBodyProps {
  // Already resolved to THIS activity's own slice — see
  // docs/ARCHITECTURE.md. The shell picks context.activities[id]
  // once so no body has to know the map shape.
  context: ActivityContext;
  initial: unknown;
  copy: Copy["sheets"];
  lang: Lang;
  onChange: (details: unknown) => void;
  // The activity itself. The seven original bodies ignore this — everything
  // they need is in `context`, which is built from config-schemas.ts. The
  // generic bodies have no such config to read, so their whole form (a
  // number, a unit, a target to compare against, or — for Checklist — the
  // activity's own named items) comes from here.
  habit: Pick<
    CheckWithActivity,
    "name" | "metricType" | "unit" | "target" | "minimalAction" | "config"
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
