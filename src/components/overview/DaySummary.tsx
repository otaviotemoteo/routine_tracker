"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { format, habitName, type Copy, type Lang } from "@/lib/i18n";

export interface SummaryHabit {
  slug: string;
  name: string;
  done: boolean;
  value: string | null;
}

interface DaySummaryProps {
  date: string;
  title: string;
  habits: SummaryHabit[];
  lang: Lang;
  copy: Copy["overview"];
}

// What a single day amounted to. It sits *below* the grid rather than floating
// over it: a panel that covered the cells it describes would hide the ringed
// column the reader just picked. Dark on the cream page so it still reads as a
// detail of the selection rather than another section.
export function DaySummary({
  date,
  title,
  habits,
  lang,
  copy,
}: DaySummaryProps) {
  const done = habits.filter((habit) => habit.done).length;

  return (
    <div className="bg-forest text-cream rounded-card p-3 sm:p-4">
      <div className="flex items-baseline gap-3 flex-wrap mb-3">
        <span className="font-semibold">{title}</span>
        <span className="font-mono text-xs opacity-60">
          {format(copy.dayOf, { done, total: habits.length })}
        </span>
        <Link
          href={`/overview/${date}`}
          className="ml-auto min-h-[36px] inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-clover text-white font-semibold text-xs"
        >
          {copy.seeDay}
          <ArrowRight className="w-3.5 h-3.5" aria-hidden />
        </Link>
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 list-none">
        {habits.map((habit) => (
          <li
            key={habit.slug}
            className="flex items-baseline gap-2 text-[0.72rem] min-w-0"
          >
            <span className="flex-1 truncate opacity-70">
              {habitName(lang, habit.slug, habit.name)}
            </span>
            <span
              className={`font-mono font-bold shrink-0 ${
                habit.done ? "text-mint" : "opacity-35"
              }`}
            >
              {habit.done ? (habit.value ?? "✓") : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
