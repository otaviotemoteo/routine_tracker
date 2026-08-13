"use client";

import { useState } from "react";
import { DaySummary } from "./DaySummary";
import { useDaySelection } from "./use-day-selection";
import { habitIcon } from "@/lib/icons";
import { habitName, type Copy, type Lang } from "@/lib/i18n";
import type { WeekData } from "@/types/habit";

interface WeekGridProps {
  week: WeekData;
  today: string;
  lang: Lang;
  copy: Copy["week"];
  overviewCopy: Copy["overview"];
  dayNames: string[]; // full weekday names, Monday-first
  optionalLabel: string;
}

// Beside the cell you're pointing at, on whichever side keeps the summary
// inside the card. The later columns flip to the left.
function anchor(index: number): string {
  return index >= 4 ? "right-full mr-2" : "left-full ml-2";
}

// Habit × day. Selecting a day rings the whole column and opens its summary —
// floating beside the day on a wide screen, in flow under the grid on a phone.
// The grid answers "how am I doing"; the summary answers "what happened that
// day".
export function WeekGrid({
  week,
  today,
  lang,
  copy,
  overviewCopy,
  dayNames,
  optionalLabel,
}: WeekGridProps) {
  const { openDay, open, toggle, close } = useDaySelection();
  // The summary describes a column, but it hangs off the cell you're actually
  // pointing at — anchoring it to the header would park it above your cursor.
  const [openRow, setOpenRow] = useState(0);

  const required = week.habits.filter((h) => !h.optional);
  const optional = week.habits.filter((h) => h.optional);
  const rows = [...required, ...optional];

  const summaryHabits =
    openDay === null
      ? []
      : week.habits.map((h) => ({
          slug: h.slug,
          name: h.name,
          done: h.cells[openDay].done,
          value: h.cells[openDay].value,
        }));

  return (
    <div
      className="bg-white border-2 border-forest rounded-card shadow-hard p-3 sm:p-4"
      // Mouse only: a tap that "leaves" the card would close the summary it
      // just opened.
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") close();
      }}
    >
      {/* The table fits from sm up, and the floating summary has to escape this
          box — an overflow container would clip it. */}
      <div className="overflow-x-auto sm:overflow-visible">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[0.6rem] uppercase tracking-wider font-semibold opacity-50 pb-2">
                {overviewCopy.habitColumn}
              </th>
              {copy.dayLabels.map((label, i) => (
                <th key={i} scope="col" className="pb-2 px-0.5">
                  <button
                    type="button"
                    onPointerEnter={(event) => {
                      if (event.pointerType !== "mouse" || !week.tracked[i])
                        return;
                      open(i);
                      setOpenRow(0);
                    }}
                    onFocus={() => {
                      if (!week.tracked[i]) return;
                      open(i);
                      setOpenRow(0);
                    }}
                    onClick={() => {
                      if (!week.tracked[i]) return;
                      setOpenRow(0);
                      toggle(i);
                    }}
                    aria-label={`${dayNames[i]} ${week.days[i].slice(8, 10)}`}
                    className={`w-full flex flex-col items-center leading-none ${
                      week.days[i] === today
                        ? "text-clover"
                        : openDay === i
                          ? "text-forest"
                          : "text-forest/45"
                    }`}
                  >
                    <span className="text-[0.55rem] font-bold uppercase tracking-wide">
                      {label}
                    </span>
                    <span className="font-mono text-[0.7rem] font-bold mt-0.5">
                      {week.days[i].slice(8, 10)}
                    </span>
                  </button>
                </th>
              ))}
              <th className="text-right text-[0.6rem] uppercase tracking-wider font-semibold opacity-50 pb-2 pl-1">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((habit, row) => {
              const Icon = habitIcon(habit.templateKind, habit.domainSlug);
              return (
                <tr
                  key={habit.habitId}
                  className="border-t-2 border-dashed border-sand"
                >
                  <td className="py-1 pr-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Icon
                        aria-hidden
                        className="w-3.5 h-3.5 shrink-0 opacity-60"
                      />
                      <span className="text-[0.7rem] font-semibold truncate max-w-[7rem]">
                        {habitName(lang, habit.slug, habit.name)}
                      </span>
                      {habit.optional && (
                        <span className="shrink-0 text-[0.5rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sand text-forest/60">
                          {optionalLabel}
                        </span>
                      )}
                    </span>
                  </td>
                  {habit.cells.map((cell, i) => {
                    // Outside the record — not yet, or before the first check.
                    const future = !week.tracked[i];
                    return (
                      <td key={i} className="relative px-0.5 py-1">
                        <button
                          type="button"
                          onPointerEnter={(event) => {
                            if (event.pointerType !== "mouse" || !week.tracked[i])
                              return;
                            open(i);
                            setOpenRow(row);
                          }}
                          onFocus={() => {
                            if (!week.tracked[i]) return;
                            open(i);
                            setOpenRow(row);
                          }}
                          onClick={() => {
                            if (!week.tracked[i]) return;
                            setOpenRow(row);
                            toggle(i);
                          }}
                          aria-label={`${habitName(lang, habit.slug, habit.name)}, ${dayNames[i]}: ${
                            cell.done
                              ? (cell.value ?? copy.done)
                              : future
                                ? copy.noRecordYet
                                : copy.notDone
                          }`}
                          className={`w-full h-[26px] rounded-md border text-[0.6rem] font-mono font-bold flex items-center justify-center transition-shadow ${
                            cell.done
                              ? cell.partial
                                ? "bg-straw/35 border-straw/50 text-forest"
                                : "bg-clover border-clover text-white"
                              : future
                                ? "bg-sand/25 border-transparent text-transparent"
                                : "bg-sand border-forest/10 text-forest/40"
                          } ${openDay === i ? "ring-2 ring-forest ring-offset-1" : ""}`}
                        >
                          {cell.done ? (cell.partial ? "~" : "✓") : "—"}
                        </button>

                        {openDay === i && openRow === row && (
                          <div
                            className={`hidden sm:block absolute top-1/2 -translate-y-1/2 z-30 ${anchor(i)}`}
                          >
                            <DaySummary
                              date={week.days[i]}
                              title={`${dayNames[i]}, ${week.days[i].slice(8, 10)}`}
                              habits={summaryHabits}
                              lang={lang}
                              copy={overviewCopy}
                              floating
                            />
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-right pl-1">
                    <span
                      className={`font-mono text-[0.7rem] font-bold ${
                        habit.percent >= 70
                          ? "text-clover"
                          : habit.percent >= 40
                            ? "opacity-60"
                            : "text-straw"
                      }`}
                    >
                      {habit.percent}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openDay !== null && (
        <div className="sm:hidden mt-3">
          <DaySummary
            date={week.days[openDay]}
            title={`${dayNames[openDay]}, ${week.days[openDay].slice(8, 10)}`}
            habits={summaryHabits}
            lang={lang}
            copy={overviewCopy}
          />
        </div>
      )}
    </div>
  );
}
