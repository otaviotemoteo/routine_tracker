"use client";

import { Check } from "lucide-react";
import { habitIcon } from "@/lib/icons";
import type { CheckWithHabit } from "@/types/habit";

interface HabitCardProps {
  check: CheckWithHabit;
  onToggle: (id: number, done: boolean) => void;
}

// The whole card is the toggle button — optimistic: the parent flips the
// state instantly and rolls back if the PATCH fails.
export function HabitCard({ check, onToggle }: HabitCardProps) {
  const Icon = habitIcon(check.slug);

  return (
    <button
      type="button"
      onClick={() => onToggle(check.id, !check.done)}
      aria-pressed={check.done}
      className={`min-h-[92px] text-left p-4 rounded-card border-2 border-forest shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 ${
        check.optional ? "border-dashed" : ""
      } ${check.done ? "bg-mint" : "bg-white"}`}
    >
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
      <span className="block font-semibold mt-2.5">{check.name}</span>
      {check.optional && (
        <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] opacity-60 mt-0.5">
          opcional
        </span>
      )}
    </button>
  );
}
