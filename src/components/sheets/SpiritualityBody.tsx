"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { asRecord, type SheetBodyProps } from "./types";

interface PracticeState {
  on: boolean;
  count: number;
}

export function SpiritualityBody({
  context,
  initial,
  copy,
  onChange,
}: SheetBodyProps) {
  const practices = context.practices;
  const initialRecord = asRecord(initial);
  const initialDone = Array.isArray(initialRecord?.practices)
    ? (initialRecord!.practices as { slug: string; count?: number }[])
    : [];

  const [state, setState] = useState<Record<string, PracticeState>>(() => {
    const map: Record<string, PracticeState> = {};
    for (const p of practices) {
      const found = initialDone.find((d) => d.slug === p.slug);
      map[p.slug] = { on: Boolean(found), count: found?.count ?? 1 };
    }
    return map;
  });

  useEffect(() => {
    if (practices.length === 0) {
      onChange(null);
      return;
    }
    onChange({
      practices: practices
        .filter((p) => state[p.slug]?.on)
        .map((p) =>
          p.countable
            ? { slug: p.slug, count: state[p.slug].count }
            : { slug: p.slug }
        ),
    });
  }, [practices, state, onChange]);

  if (practices.length === 0) {
    return <p className="opacity-75">{copy.spirituality.noPractices}</p>;
  }

  return (
    <ul className="flex flex-col gap-2 list-none">
      {practices.map((p) => {
        const s = state[p.slug];
        return (
          <li key={p.slug} className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-3 min-h-[44px] font-medium">
              <input
                type="checkbox"
                checked={s.on}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    [p.slug]: { ...prev[p.slug], on: e.target.checked },
                  }))
                }
                className="w-6 h-6 accent-clover"
              />
              {p.name}
            </label>
            {p.countable && s.on && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="-"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      [p.slug]: {
                        ...prev[p.slug],
                        count: Math.max(1, prev[p.slug].count - 1),
                      },
                    }))
                  }
                  className="min-h-[44px] min-w-[44px] rounded-lg border-2 border-forest bg-white inline-flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" aria-hidden />
                </button>
                <span className="font-mono font-bold w-6 text-center">
                  {s.count}
                </span>
                <button
                  type="button"
                  aria-label="+"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      [p.slug]: { ...prev[p.slug], count: prev[p.slug].count + 1 },
                    }))
                  }
                  className="min-h-[44px] min-w-[44px] rounded-lg border-2 border-forest bg-white inline-flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" aria-hidden />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
