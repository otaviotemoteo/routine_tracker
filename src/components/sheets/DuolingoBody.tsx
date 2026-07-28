"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { asRecord, labelClass, type SheetBodyProps } from "./types";

export function DuolingoBody({ context, initial, copy, onChange }: SheetBodyProps) {
  const langs = context.languages;
  const initialRecord = asRecord(initial);
  const initialSessions = Array.isArray(initialRecord?.sessions)
    ? (initialRecord!.sessions as { language_slug: string; lessons: number }[])
    : [];

  const [lessons, setLessons] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const l of langs) {
      map[l.slug] =
        initialSessions.find((s) => s.language_slug === l.slug)?.lessons ?? 0;
    }
    return map;
  });

  useEffect(() => {
    if (langs.length === 0) {
      onChange(null);
      return;
    }
    onChange({
      sessions: langs.map((l) => ({
        language_slug: l.slug,
        lessons: lessons[l.slug] ?? 0,
      })),
    });
  }, [langs, lessons, onChange]);

  if (langs.length === 0) {
    return <p className="opacity-75">{copy.duolingo.noLanguages}</p>;
  }

  const step = (slug: string, delta: number) =>
    setLessons((prev) => ({ ...prev, [slug]: Math.max(0, (prev[slug] ?? 0) + delta) }));

  return (
    <div className="flex flex-col gap-3">
      <span className={labelClass}>{copy.duolingo.lessons}</span>
      {/* One card per language: without the boxes, several rows of stepper
          controls read as one undifferentiated list. */}
      {langs.map((l) => (
        <div
          key={l.slug}
          className="flex items-center justify-between gap-3 border-2 border-forest rounded-card bg-cream px-4 py-2.5"
        >
          <span className="font-semibold">{l.name}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="-"
              onClick={() => step(l.slug, -1)}
              className="min-h-[44px] min-w-[44px] rounded-lg border-2 border-forest bg-white inline-flex items-center justify-center"
            >
              <Minus className="w-4 h-4" aria-hidden />
            </button>
            <span className="font-mono font-bold w-8 text-center">
              {lessons[l.slug] ?? 0}
            </span>
            <button
              type="button"
              aria-label="+"
              onClick={() => step(l.slug, 1)}
              className="min-h-[44px] min-w-[44px] rounded-lg border-2 border-forest bg-white inline-flex items-center justify-center"
            >
              <Plus className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
