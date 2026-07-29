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
  // Desktop only: floats beside the picked day. On a phone there is no "beside",
  // so the caller renders it in flow under the grid instead.
  floating?: boolean;
}

// What a single day amounted to. Same card language as the rest of the page —
// cream panel, 2px border, hard shadow — so it reads as a detail of the
// selection rather than a foreign overlay.
export function DaySummary({
  date,
  title,
  habits,
  lang,
  copy,
  floating = false,
}: DaySummaryProps) {
  const done = habits.filter((habit) => habit.done).length;

  return (
    <div
      // text-left: the week grid renders this inside a <th>, which centres by
      // default.
      className={`text-left bg-cream border-2 border-forest rounded-card ${
        floating ? "w-56 p-3 shadow-hard-lg" : "p-3 sm:p-4 shadow-hard"
      }`}
    >
      <div className="flex items-baseline gap-2 flex-wrap mb-2.5">
        <span className="font-semibold text-sm">{title}</span>
        <span className="font-mono text-[0.7rem] opacity-55">
          {format(copy.dayOf, { done, total: habits.length })}
        </span>
      </div>

      <ul
        className={`list-none ${
          floating
            ? "flex flex-col gap-1"
            : "grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5"
        }`}
      >
        {habits.map((habit) => (
          <li
            key={habit.slug}
            className="flex items-baseline gap-2 text-[0.72rem] min-w-0"
          >
            <span
              className={`flex-1 truncate ${
                habit.done ? "font-medium" : "opacity-45"
              }`}
            >
              {habitName(lang, habit.slug, habit.name)}
            </span>
            <span
              className={`font-mono font-bold shrink-0 ${
                habit.done ? "text-clover" : "opacity-30"
              }`}
            >
              {habit.done ? (habit.value ?? "✓") : "—"}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={`/overview/${date}`}
        className="mt-2.5 min-h-[36px] flex items-center justify-center gap-1.5 rounded-lg border-2 border-forest bg-clover text-white font-semibold text-xs"
      >
        {copy.seeDay}
        <ArrowRight className="w-3.5 h-3.5" aria-hidden />
      </Link>
    </div>
  );
}
