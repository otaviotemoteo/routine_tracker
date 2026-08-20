import { habitIcon } from "@/lib/icons";
import { isDomainSlug } from "@/lib/domains";
import { ASSESSMENT_COPY } from "@/lib/i18n-assessment";
import { format, type Copy, type Lang } from "@/lib/i18n";
import type { ActivityWithHabit } from "@/db/habits";

interface HabitSummaryRowProps {
  habit: ActivityWithHabit;
  lang: Lang;
  copy: Copy["habits"];
  streak?: number;
}

// The read-only twin of HabitRow, for the Overview section.
//
// Deliberately a separate component rather than a prop on that one. HabitRow
// is a Client Component carrying a confirmation dialog and two server actions,
// and none of that belongs on a screen whose job is to report — Overview says
// what you track, and every change to it happens on /habits. Sharing the
// component would have meant shipping the delete dialog to a page that must
// not offer deleting.
export function HabitSummaryRow({
  habit,
  lang,
  copy,
  streak,
}: HabitSummaryRowProps) {
  const Icon = habitIcon(habit.templateKind, habit.domainSlug);

  const area =
    habit.domainSlug && isDomainSlug(habit.domainSlug)
      ? ASSESSMENT_COPY[lang].domains[habit.domainSlug].name
      : copy.unanchored;

  const badge =
    habit.metricType === "binary"
      ? copy.badgeBinary
      : (habit.unit?.trim() || copy.badgeBinary).toUpperCase();

  return (
    <li className="border-2 border-forest rounded-card bg-white shadow-hard min-h-[60px] flex items-center gap-3 flex-wrap px-3 py-2.5">
      <span
        aria-hidden
        className="shrink-0 w-9 h-9 rounded-lg bg-mint flex items-center justify-center"
      >
        <Icon className="w-4 h-4 text-clover" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold break-words">{habit.name}</span>
          <span className="shrink-0 font-mono text-[10px] font-bold tracking-wider text-clover bg-mint px-2 py-0.5 rounded-full">
            {badge}
          </span>
        </div>
        {/* The area, because grouping the whole list by it would make this
            section as tall as the page it is a summary of. */}
        <p className="text-sm opacity-60 truncate">{area}</p>
      </div>

      {/* No zero. A habit with no run going has nothing to report here, and a
          "0" would read as a verdict rather than as an absence of data. */}
      {streak !== undefined && streak > 0 && (
        <p className="shrink-0 text-right leading-none">
          <span className="block font-mono font-bold text-straw">
            {format(copy.streakValue, { n: streak })}
          </span>
          <span className="block text-[9px] font-bold tracking-wider opacity-50 mt-0.5">
            {copy.streakLabel}
          </span>
        </p>
      )}
    </li>
  );
}
