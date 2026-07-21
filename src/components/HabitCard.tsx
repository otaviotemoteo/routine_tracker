"use client";

import { Check } from "lucide-react";
import { habitIcon } from "@/lib/icons";
import { habitName, type Lang } from "@/lib/i18n";
import type { CheckWithHabit } from "@/types/habit";

interface HabitCardProps {
  check: CheckWithHabit;
  lang: Lang;
  optionalLabel: string;
  // While the day is saved, cards only display state; editing re-enables them.
  interactive: boolean;
  stateLabels: { done: string; notDone: string };
  onToggle: (id: number, done: boolean) => void;
}

export function HabitCard({
  check,
  lang,
  optionalLabel,
  interactive,
  stateLabels,
  onToggle,
}: HabitCardProps) {
  const Icon = habitIcon(check.slug);
  const name = habitName(lang, check.slug, check.name);

  const baseClasses = `min-h-[92px] text-left p-4 rounded-card border-2 border-forest shadow-hard ${
    check.optional ? "border-dashed" : ""
  } ${check.done ? "bg-mint" : "bg-white"}`;

  const content = (
    <>
      <span className="flex items-start justify-between gap-2">
        <Icon aria-hidden className="w-6 h-6 text-clover" />
        <span
          aria-hidden
          className={`w-[30px] h-[30px] shrink-0 rounded-lg border-2 border-forest flex items-center justify-center ${
            check.done ? "bg-clover text-white" : "bg-white"
          }`}
        >
          {check.done && <Check className="w-5 h-5" strokeWidth={3.5} />}
        </span>
      </span>
      <span className="block font-semibold mt-2.5">{name}</span>
      {check.optional && (
        <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] opacity-60 mt-0.5">
          {optionalLabel}
        </span>
      )}
    </>
  );

  if (!interactive) {
    return (
      <div className={baseClasses}>
        {content}
        <span className="sr-only">
          {check.done ? stateLabels.done : stateLabels.notDone}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onToggle(check.id, !check.done)}
      aria-pressed={check.done}
      className={`${baseClasses} transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5`}
    >
      {content}
    </button>
  );
}
