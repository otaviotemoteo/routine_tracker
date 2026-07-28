"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CircleAlert, ListChecks } from "lucide-react";
import { HabitCard } from "@/components/HabitCard";
import type { Copy, Lang } from "@/lib/i18n";
import type { CheckWithHabit } from "@/types/habit";

interface TodayChecklistProps {
  initialChecks: CheckWithHabit[];
  title: string;
  lang: Lang;
  copy: Copy["today"];
  dailyCopy: Copy["daily"];
}

// Owns the day's checks so the progress bar reflects every quick-toggle.
// Detailed logging happens in the guided flow at /day — the "Complete daily"
// button starts it and each card deep-links into its own step.
export function TodayChecklist({
  initialChecks,
  title,
  lang,
  copy,
  dailyCopy,
}: TodayChecklistProps) {
  const [checks, setChecks] = useState(initialChecks);
  const [saveError, setSaveError] = useState(false);

  const quickToggle = useCallback(async (id: number, done: boolean) => {
    setSaveError(false);
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, done } : c)));
    try {
      const res = await fetch(`/api/checks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
    } catch {
      setChecks((prev) =>
        prev.map((c) => (c.id === id ? { ...c, done: !done } : c))
      );
      setSaveError(true);
    }
  }, []);

  const required = checks.filter((c) => !c.optional);
  const doneCount = required.filter((c) => c.done).length;
  const percent =
    required.length === 0 ? 0 : Math.round((doneCount / required.length) * 100);
  const allDone = required.length > 0 && doneCount === required.length;

  return (
    <>
      <h1 className="display-title text-4xl sm:text-5xl mt-2 mb-7">{title}</h1>

      <div className="flex flex-col gap-5">
        <section
          aria-label={copy.progressAria}
          className="bg-white border-2 border-forest rounded-card shadow-hard px-5 py-4"
        >
          <div className="flex justify-between items-baseline font-semibold mb-2.5">
            <span>{allDone ? copy.dayComplete : copy.progress}</span>
            <span className="font-mono font-bold text-sm">
              {doneCount}/{required.length} · {percent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={required.length}
            aria-label={copy.progressAria}
            className="h-4 border-2 border-forest rounded-full bg-sand overflow-hidden"
          >
            <div
              className={`h-full bg-clover transition-[width] duration-300 ${
                percent > 0 && percent < 100 ? "border-r-2 border-forest" : ""
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          {doneCount === 0 && (
            <p className="text-sm opacity-75 mt-2.5">{copy.firstHint}</p>
          )}
        </section>

        {saveError && (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm font-semibold bg-white border-2 border-forest rounded-card shadow-hard px-4 py-3"
          >
            <CircleAlert aria-hidden className="w-5 h-5 text-straw shrink-0" />
            {copy.saveError}
          </p>
        )}

        <Link
          href="/day"
          className="min-h-[52px] inline-flex items-center justify-center gap-2 px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
        >
          <ListChecks aria-hidden className="w-5 h-5" />
          {dailyCopy.start}
        </Link>

        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4 list-none">
          {checks.map((check) => (
            <li key={check.id} className="contents">
              <HabitCard
                check={check}
                lang={lang}
                copy={copy}
                onQuickToggle={quickToggle}
              />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
