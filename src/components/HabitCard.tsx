import { Check, Clock } from "lucide-react";
import { PaceInfo } from "@/components/PaceInfo";
import { habitIcon } from "@/lib/icons";
import { habitName, type Copy, type Lang } from "@/lib/i18n";
import { buildTodayCard, type ReadingPace } from "@/lib/today-card";
import type { PaceValues } from "@/lib/setup-summary";
import type { CheckWithHabit, TodayContext } from "@/types/habit";

interface HabitCardProps {
  check: CheckWithHabit;
  context: TodayContext;
  lang: Lang;
  copy: Copy["today"];
  readingCopy: Copy["onboarding"]["reading"];
  // Reading only: the target and the numbers behind it.
  pace?: ReadingPace;
  paceValues?: PaceValues;
}

// One anatomy for every habit — status pill, a hero number, a context line and
// a note pinned to the bottom — so the cards line up and read in the same
// order. Read-only: all logging happens in the guided flow.
export function HabitCard({
  check,
  context,
  lang,
  copy,
  readingCopy,
  pace,
  paceValues,
}: HabitCardProps) {
  const Icon = habitIcon(check.slug);
  const name = habitName(lang, check.slug, check.name);
  const card = buildTodayCard(check, context, copy, lang, pace);

  const pill = {
    done: { label: copy.pillDone, className: "text-clover bg-mint" },
    extra: { label: copy.pillExtra, className: "text-clover bg-mint" },
    pending: { label: copy.pillPending, className: "text-straw bg-straw/15" },
  }[card.state];

  return (
    <div
      className={`h-full flex flex-col gap-2.5 p-4 rounded-card border-2 border-forest shadow-hard ${
        check.optional ? "border-dashed" : ""
      } ${card.state === "pending" ? "bg-cream" : "bg-white"}`}
    >
      <div className="flex items-center gap-2">
        <Icon aria-hidden className="w-4 h-4 shrink-0 text-clover" />
        <span className="font-semibold text-sm flex-1 min-w-0 truncate">
          {name}
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[0.62rem] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${pill.className}`}
        >
          {card.state === "pending" ? (
            <Clock className="w-3 h-3" strokeWidth={3} aria-hidden />
          ) : (
            <Check className="w-3 h-3" strokeWidth={3.5} aria-hidden />
          )}
          {pill.label}
        </span>
      </div>

      {/* The number carries the point; the unit tells you what it counts. */}
      <p className="flex items-baseline gap-1.5">
        <span className="font-mono font-bold text-2xl leading-none">
          {card.hero.value}
        </span>
        <span className="text-sm font-semibold opacity-60">
          {card.hero.unit}
        </span>
      </p>

      {card.context && (
        <p className="text-xs font-medium opacity-60 leading-snug">
          {card.context}
        </p>
      )}

      {card.note && (
        // mt-auto pins the note to the bottom, so cards of different content
        // still line up.
        <div
          className={`mt-auto rounded-lg px-3 py-2 flex items-center gap-2 ${
            card.state === "pending" ? "bg-straw/15" : "bg-cream"
          }`}
        >
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-bold leading-snug">
              {card.note.primary}
            </span>
            {card.note.secondary && (
              <span
                className={`block text-[0.7rem] font-medium leading-snug mt-0.5 ${
                  card.state === "pending" ? "text-straw" : "opacity-55"
                }`}
              >
                {card.note.secondary}
              </span>
            )}
          </span>
          {paceValues && (
            <PaceInfo copy={readingCopy} values={paceValues} />
          )}
        </div>
      )}
    </div>
  );
}
