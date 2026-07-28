"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { habitIcon } from "@/lib/icons";
import { format, habitName, type Copy, type Lang } from "@/lib/i18n";
import { summarizeDetails } from "@/lib/summaries";
import type { CheckWithHabit } from "@/types/habit";

interface HabitCardProps {
  check: CheckWithHabit;
  lang: Lang;
  copy: Copy["today"];
  onQuickToggle: (id: number, done: boolean) => void;
}

// Two targets: the whole card enters the guided daily flow at this habit's
// step; the box in the corner is a quick-toggle (done without details) for
// rushed days. Both ≥44px — the card link is an absolute <a> overlay and the
// box is a <button> stacked above it (no nested interactive elements).
export function HabitCard({
  check,
  lang,
  copy,
  onQuickToggle,
}: HabitCardProps) {
  const Icon = habitIcon(check.slug);
  const name = habitName(lang, check.slug, check.name);
  const badge = check.done ? summarizeDetails(check.slug, check.details) : null;

  return (
    <div
      className={`relative min-h-[92px] rounded-card border-2 border-forest shadow-hard ${
        check.optional ? "border-dashed" : ""
      } ${check.done ? "bg-mint" : "bg-white"}`}
    >
      <Link
        href={`/day?step=${check.slug}`}
        aria-label={format(copy.openDetails, { habit: name })}
        className="absolute inset-0 rounded-card"
      />
      <div className="relative p-4 pointer-events-none">
        <span className="flex items-start justify-between gap-2">
          <Icon aria-hidden className="w-6 h-6 text-clover" />
        </span>
        <span className="block font-semibold mt-2.5">{name}</span>
        {badge ? (
          <span className="block text-xs font-mono font-bold text-clover mt-0.5">
            {badge}
          </span>
        ) : check.optional ? (
          <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] opacity-60 mt-0.5">
            {copy.optional}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onQuickToggle(check.id, !check.done)}
        aria-pressed={check.done}
        aria-label={format(check.done ? copy.markNotDone : copy.markDone, {
          habit: name,
        })}
        className="absolute top-1.5 right-1.5 z-10 min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <span
          aria-hidden
          className={`w-[30px] h-[30px] rounded-lg border-2 border-forest flex items-center justify-center ${
            check.done ? "bg-clover text-white" : "bg-white"
          }`}
        >
          {check.done && <Check className="w-5 h-5" strokeWidth={3.5} aria-hidden />}
        </span>
      </button>
    </div>
  );
}
