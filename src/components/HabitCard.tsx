import { Check } from "lucide-react";
import { habitIcon } from "@/lib/icons";
import { habitName, type Copy, type Lang } from "@/lib/i18n";
import { cardStatus } from "@/lib/card-status";
import type { CheckWithHabit, TodayContext } from "@/types/habit";

interface HabitCardProps {
  check: CheckWithHabit;
  context: TodayContext;
  lang: Lang;
  copy: Copy["today"];
}

// Read-only status card: says whether the habit is done and what it logged, or
// what today expects of it. All logging happens in the guided flow (/day), so
// this card has no controls — and no client JS.
export function HabitCard({ check, context, lang, copy }: HabitCardProps) {
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
          <span
            aria-hidden
            className="w-[30px] h-[30px] shrink-0 rounded-lg border-2 border-dashed border-forest/35"
          />
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
          className={`text-xs mt-0.5 ${
            check.done
              ? "font-mono font-bold text-clover"
              : "opacity-70 leading-snug"
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
    </div>
  );
}
