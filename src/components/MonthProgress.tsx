import { Flame } from "lucide-react";
import { habitIcon } from "@/lib/icons";
import { format, habitName, plural, type Copy, type Lang } from "@/lib/i18n";
import type { MonthHabitStats } from "@/types/habit";

interface MonthProgressProps {
  habits: MonthHabitStats[];
  lang: Lang;
  copy: Copy["month"];
}

function HabitRow({
  stats,
  lang,
  copy,
}: {
  stats: MonthHabitStats;
  lang: Lang;
  copy: Copy["month"];
}) {
  const Icon = habitIcon(stats.slug);
  const name = habitName(lang, stats.slug, stats.name);
  const dayUnit = plural(stats.streak, copy.dayUnitOne, copy.dayUnitOther);
  return (
    <li
      className={`bg-white border-2 border-forest rounded-card shadow-hard px-5 py-4 ${
        stats.optional ? "border-dashed" : ""
      }`}
    >
      <div className="flex justify-between items-baseline gap-3 flex-wrap mb-2">
        <span className="inline-flex items-center gap-2 font-semibold">
          <Icon aria-hidden className="w-5 h-5 text-clover shrink-0" />
          {name}
          {stats.optional && (
            <span className="text-[0.68rem] uppercase tracking-[0.12em] opacity-60">
              {copy.optional}
            </span>
          )}
        </span>
        <span className="font-mono font-bold text-sm whitespace-nowrap">
          {stats.percent}% ({stats.doneCount}/{stats.countedDays}) ·{" "}
          <span
            className={`text-straw ${stats.streak === 0 ? "opacity-40" : ""}`}
            aria-label={format(copy.streakAria, {
              count: stats.streak,
              unit: dayUnit,
            })}
          >
            <Flame aria-hidden className="inline w-4 h-4 -mt-0.5" />{" "}
            {stats.streak} {dayUnit}
          </span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={stats.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={format(copy.adherenceAria, { name })}
        className="h-4 border-2 border-forest rounded-full bg-sand overflow-hidden"
      >
        <div
          className={`h-full bg-clover ${
            stats.percent > 0 && stats.percent < 100
              ? "border-r-2 border-forest"
              : ""
          }`}
          style={{ width: `${stats.percent}%` }}
        />
      </div>
    </li>
  );
}

// One adherence bar + current streak per habit. Numbers in JetBrains Mono,
// streak in straw — the color reserved for it (README design system).
export function MonthProgress({ habits, lang, copy }: MonthProgressProps) {
  return (
    <ul className="flex flex-col gap-4 list-none">
      {habits.map((stats) => (
        <HabitRow key={stats.habitId} stats={stats} lang={lang} copy={copy} />
      ))}
    </ul>
  );
}
