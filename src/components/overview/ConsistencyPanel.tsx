import { habitIcon } from "@/lib/icons";
import { habitName, type Copy, type Lang } from "@/lib/i18n";
import type { MonthActivityStats } from "@/types/habit";

interface ConsistencyPanelProps {
  habits: MonthActivityStats[];
  // Done-days per slug last month, for the delta column.
  previous: Record<string, number>;
  // False when last month is entirely before the first record — "+9" against a
  // month that was never tracked reads as progress that didn't happen.
  comparable: boolean;
  lang: Lang;
  copy: Copy["overview"];
}

// Habits ranked by how consistent they were, with the change since last month
// — the month's "which of these is slipping" answer.
export function ConsistencyPanel({
  habits,
  previous,
  comparable,
  lang,
  copy,
}: ConsistencyPanelProps) {
  const ranked = [...habits].sort((a, b) => b.doneCount - a.doneCount);

  return (
    <section
      aria-label={copy.consistency}
      className="bg-white border-2 border-forest rounded-card shadow-hard p-4"
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-[0.6rem] uppercase tracking-wider font-semibold opacity-50">
          {copy.consistency}
        </h3>
        {comparable && (
          <span className="text-[0.6rem] uppercase tracking-wider font-semibold opacity-35">
            {copy.vsPrevious}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-2.5 list-none">
        {ranked.map((habit) => {
          const Icon = habitIcon(habit.templateKind, habit.domainSlug);
          const ratio =
            habit.countedDays === 0 ? 0 : habit.doneCount / habit.countedDays;
          const delta = habit.doneCount - (previous[habit.slug] ?? 0);
          return (
            <li key={habit.activityId} className="flex items-center gap-2.5">
              <Icon aria-hidden className="w-3.5 h-3.5 shrink-0 opacity-60" />
              <span className="w-[5.5rem] shrink-0 text-[0.7rem] font-semibold truncate">
                {habitName(lang, habit.slug, habit.name)}
              </span>
              <span className="flex-1 h-3 rounded-full bg-sand overflow-hidden">
                <span
                  className={`block h-full rounded-full ${
                    ratio >= 0.7
                      ? "bg-clover"
                      : ratio >= 0.45
                        ? "bg-clover/50"
                        : "bg-straw/60"
                  }`}
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </span>
              <span className="w-12 shrink-0 text-right font-mono text-[0.7rem] font-bold">
                {habit.doneCount}/{habit.countedDays}
              </span>
              {comparable && (
                <span
                  className={`w-7 shrink-0 text-right font-mono text-[0.65rem] font-bold ${
                    delta > 0
                      ? "text-clover"
                      : delta < 0
                        ? "text-straw"
                        : "opacity-30"
                  }`}
                >
                  {delta > 0 ? `+${delta}` : delta < 0 ? delta : "—"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
