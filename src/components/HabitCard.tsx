import { Check, Clock } from "lucide-react";
import { PaceInfo } from "@/components/PaceInfo";
import { habitIcon } from "@/lib/icons";
import { habitName, type Copy, type Lang } from "@/lib/i18n";
import { cardStatus } from "@/lib/card-status";
import type { CheckWithHabit, TodayContext } from "@/types/habit";

interface HabitCardProps {
  check: CheckWithHabit;
  context: TodayContext;
  lang: Lang;
  copy: Copy["today"];
  readingCopy: Copy["onboarding"]["reading"];
  // Pages/day needed to finish the reading list this year — shown on the
  // reading card so the target lives where the habit does.
  pacePerDay?: number;
  paceNote?: string;
}

// Read-only status card: says whether the habit is done and what it logged, or
// what today expects of it. All logging happens in the guided flow (/day), so
// this card has no controls — and no client JS.
export function HabitCard({
  check,
  context,
  lang,
  copy,
  readingCopy,
  paceNote,
}: HabitCardProps) {
  const Icon = habitIcon(check.slug);
  const name = habitName(lang, check.slug, check.name);
  const status = cardStatus(check, context, copy);
  const stateLabel = check.done ? copy.doneLabel : copy.pendingLabel;

  return (
    <div
      className={`min-h-[104px] p-4 rounded-card border-2 border-forest shadow-hard ${
        check.optional ? "border-dashed" : ""
      } ${check.done ? "bg-mint" : "bg-white"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Icon aria-hidden className="w-6 h-6 text-clover" />
        {check.done ? (
          <span
            aria-hidden
            className="w-[30px] h-[30px] shrink-0 rounded-lg border-2 border-forest bg-clover text-white flex items-center justify-center"
          >
            <Check className="w-5 h-5" strokeWidth={3.5} />
          </span>
        ) : (
          // Filled chip, not a dashed outline: an outline reads as an empty
          // input (tappable), a straw chip with a clock reads as "waiting".
          <span
            aria-hidden
            className="w-[30px] h-[30px] shrink-0 rounded-lg border-2 border-forest bg-straw/30 flex items-center justify-center"
          >
            <Clock className="w-4 h-4 text-forest/75" strokeWidth={2.5} />
          </span>
        )}
      </div>

      <p className="font-semibold mt-2.5">{name}</p>
      {/* State in text, not colour alone — unless the visible detail already
          says it (a done card with no logged summary reads "Done"). */}
      {status.detail !== stateLabel && (
        <p className="sr-only">{stateLabel}</p>
      )}

      {status.detail && (
        <p
          className={`text-xs mt-0.5 leading-snug ${
            check.done ? "font-semibold text-clover" : "opacity-70"
          }`}
        >
          {status.detail}
        </p>
      )}

      {check.optional && (
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] opacity-60 mt-1">
          {copy.optional}
        </p>
      )}

      {paceNote && (
        <p className="flex items-center gap-1.5 text-[0.7rem] leading-snug mt-2 pt-2 border-t-2 border-dashed border-sand">
          <span className="flex-1 opacity-70">{paceNote}</span>
          <PaceInfo copy={readingCopy} />
        </p>
      )}
    </div>
  );
}
