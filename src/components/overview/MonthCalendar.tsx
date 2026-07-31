"use client";

import { DaySummary } from "./DaySummary";
import { useDaySelection } from "./use-day-selection";
import { format, type Copy, type Lang } from "@/lib/i18n";
import type { MonthMatrix } from "@/db/queries";

interface MonthCalendarProps {
  matrix: MonthMatrix;
  today: string;
  lang: Lang;
  copy: Copy["overview"];
  dayLabels: string[]; // short, Monday-first
  dayNames: string[]; // full, Monday-first
}

// Five steps from "nothing" to "a full day" — the ramp has to be readable at a
// glance, so it moves in fill as well as darkness.
const LEVELS = [
  "bg-sand/50 border-forest/10 text-forest/45",
  "bg-mint border-clover/25 text-forest/70",
  "bg-clover/45 border-clover/50 text-forest",
  "bg-clover/75 border-clover text-white",
  "bg-clover border-clover text-white",
];

// Beside the day, not under it — and on whichever side keeps the summary
// inside the calendar. Later weekdays flip to the left.
function anchor(weekday: number): string {
  return weekday >= 5 ? "right-full mr-2" : "left-full ml-2";
}

function level(done: number, required: number): number {
  if (done <= 0) return 0;
  const ratio = done / Math.max(1, required);
  if (ratio >= 1) return 4;
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

export function MonthCalendar({
  matrix,
  today,
  lang,
  copy,
  dayLabels,
  dayNames,
}: MonthCalendarProps) {
  const { openDay, open: openAt, toggle, close } = useDaySelection();

  // Blank cells so the 1st lands under its weekday column.
  const lead = matrix.days.length ? matrix.days[0].weekday - 1 : 0;
  const open = openDay === null ? null : matrix.days[openDay];

  return (
    <div
      className="bg-white border-2 border-forest rounded-card shadow-hard p-3 sm:p-4"
      // Mouse only: a tap that "leaves" the card would close the summary it
      // just opened.
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") close();
      }}
    >
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {dayLabels.map((label, i) => (
          <span
            key={i}
            className="text-center text-[0.55rem] font-bold uppercase tracking-wide opacity-45"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} aria-hidden />
        ))}
        {matrix.days.map((day, i) => {
          // Outside the record — not yet, or before the first check ever made.
          const future = !day.tracked;
          return (
            <div key={day.date} className="relative flex">
            <button
              type="button"
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse" && day.tracked) openAt(i);
              }}
              onFocus={() => day.tracked && openAt(i)}
              onClick={() => day.tracked && toggle(i)}
              aria-label={`${day.dayOfMonth} — ${format(copy.dayOf, {
                done: day.doneCount,
                total: matrix.requiredCount,
              })}`}
              className={`w-full aspect-square rounded-lg border-2 flex flex-col items-center justify-center leading-none ${
                future
                  ? "bg-transparent border-forest/10 text-forest/25"
                  : LEVELS[level(day.doneCount, matrix.requiredCount)]
              } ${
                openDay === i || day.date === today
                  ? "ring-2 ring-forest ring-offset-1"
                  : ""
              }`}
            >
              <span className="font-mono text-xs font-bold">
                {day.dayOfMonth}
              </span>
              {!future && (
                <span className="text-[0.55rem] font-semibold opacity-80 mt-0.5">
                  {day.doneCount}/{matrix.requiredCount}
                </span>
              )}
            </button>

            {openDay === i && (
              <div
                className={`hidden sm:block absolute top-1/2 -translate-y-1/2 z-30 ${anchor(
                  day.weekday
                )}`}
              >
                <DaySummary
                  date={day.date}
                  title={`${dayNames[day.weekday - 1]}, ${day.dayOfMonth}`}
                  habits={day.habits}
                  lang={lang}
                  copy={copy}
                  floating
                />
              </div>
            )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t-2 border-dashed border-sand flex-wrap">
        <span className="text-[0.6rem] font-bold uppercase tracking-wider opacity-45">
          {copy.less}
        </span>
        <span className="flex gap-1">
          {LEVELS.map((cls, i) => (
            <span
              key={i}
              aria-hidden
              className={`w-3.5 h-3.5 rounded border-2 ${cls}`}
            />
          ))}
        </span>
        <span className="text-[0.6rem] font-bold uppercase tracking-wider opacity-45">
          {copy.more}
        </span>
      </div>

      {open && (
        <div className="sm:hidden mt-3">
          <DaySummary
            date={open.date}
            title={`${dayNames[open.weekday - 1]}, ${open.dayOfMonth}`}
            habits={open.habits}
            lang={lang}
            copy={copy}
          />
        </div>
      )}
    </div>
  );
}
