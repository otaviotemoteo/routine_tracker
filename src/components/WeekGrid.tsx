import { TrendingDown, TrendingUp } from "lucide-react";
import { habitIcon } from "@/lib/icons";
import { habitName, type Copy, type Lang } from "@/lib/i18n";
import type { WeekData, WeekHabitRow } from "@/types/habit";

interface WeekGridProps {
  week: WeekData;
  today: string;
  lang: Lang;
  copy: Copy["week"];
}

function GridRow({
  habit,
  days,
  today,
  lang,
  copy,
}: {
  habit: WeekHabitRow;
  days: string[];
  today: string;
  lang: Lang;
  copy: Copy["week"];
}) {
  const Icon = habitIcon(habit.slug);
  const name = habitName(lang, habit.slug, habit.name);
  return (
    <tr>
      <td className="text-xs sm:text-sm font-medium text-right pr-1.5 sm:pr-2.5 whitespace-nowrap">
        <span className="inline-flex items-center gap-1 sm:gap-1.5">
          <Icon aria-hidden className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-clover shrink-0" />
          {name}
        </span>
      </td>
      {habit.done.map((done, i) => (
        <td key={days[i]}>
          <div
            role="img"
            aria-label={`${name}, ${copy.dayLabels[i]} ${days[i].slice(8, 10)}: ${
              done ? copy.done : days[i] > today ? copy.noRecordYet : copy.notDone
            }`}
            className={`w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] rounded-md border border-forest/15 ${
              done ? "bg-clover" : days[i] > today ? "bg-transparent" : "bg-sand"
            }`}
          />
        </td>
      ))}
    </tr>
  );
}

// 7 days × 7 habits, GitHub-contributions style. Hobby (optional) sits below
// a dashed divider and never enters best/worst (README Decision 6).
export function WeekGrid({ week, today, lang, copy }: WeekGridProps) {
  const requiredRows = week.habits.filter((h) => !h.optional);
  const optionalRows = week.habits.filter((h) => h.optional);
  const byedSlug = (slug: string | null) => {
    const habit = week.habits.find((h) => h.slug === slug);
    return habit ? habitName(lang, habit.slug, habit.name) : null;
  };
  const bestName = byedSlug(week.bestSlug);
  const worstName = byedSlug(week.worstSlug);

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border-2 border-forest rounded-card shadow-hard p-3 sm:p-5 overflow-x-auto">
        <table className="border-separate border-spacing-1 sm:border-spacing-1.5 mx-auto">
          <thead>
            <tr>
              <th aria-label={copy.habitColumnAria} />
              {copy.dayLabels.map((label, i) => (
                <th
                  key={label}
                  scope="col"
                  className={`text-[0.72rem] uppercase tracking-widest font-semibold px-0.5 ${
                    week.days[i] === today ? "text-clover" : "text-forest/65"
                  }`}
                >
                  {/* Single letter on phones; cells carry the full day in
                      their aria-label. */}
                  <span aria-hidden className="sm:hidden">{label[0]}</span>
                  <span className="hidden sm:inline">{label}</span>
                  <span className="block font-mono text-[0.65rem]">
                    {week.days[i].slice(8, 10)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requiredRows.map((habit) => (
              <GridRow key={habit.habitId} habit={habit} days={week.days} today={today} lang={lang} copy={copy} />
            ))}
            {optionalRows.length > 0 && (
              <tr aria-hidden>
                <td colSpan={8} className="border-t-2 border-dashed border-sand h-2" />
              </tr>
            )}
            {optionalRows.map((habit) => (
              <GridRow key={habit.habitId} habit={habit} days={week.days} today={today} lang={lang} copy={copy} />
            ))}
          </tbody>
        </table>
      </div>

      {bestName && worstName && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-mint border-2 border-forest rounded-card shadow-hard px-5 py-4 flex items-center gap-3">
            <TrendingUp aria-hidden className="w-6 h-6 text-clover shrink-0" />
            <div>
              <dt className="text-xs uppercase tracking-widest font-semibold opacity-60">
                {copy.best}
              </dt>
              <dd className="font-semibold">{bestName}</dd>
            </div>
          </div>
          <div className="bg-white border-2 border-forest rounded-card shadow-hard px-5 py-4 flex items-center gap-3">
            <TrendingDown aria-hidden className="w-6 h-6 text-straw shrink-0" />
            <div>
              <dt className="text-xs uppercase tracking-widest font-semibold opacity-60">
                {copy.worst}
              </dt>
              <dd className="font-semibold">{worstName}</dd>
            </div>
          </div>
        </dl>
      )}
    </div>
  );
}
