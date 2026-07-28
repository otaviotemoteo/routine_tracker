"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  ghostButton,
  inputClass,
  OnboardingFooter,
} from "./OnboardingChrome";
import type { Copy } from "@/lib/i18n";

export interface RoutineBlockDraft {
  startTime: string;
  endTime: string;
  activity: string;
  weekdays: number[];
}

interface RoutineStepProps {
  action: (formData: FormData) => Promise<void>;
  next: string;
  backHref?: string;
  skipHref?: string;
  submitLabel: string;
  copy: Copy["onboarding"];
  initialBlocks: RoutineBlockDraft[];
}

export function RoutineStep({
  action,
  next,
  backHref,
  skipHref,
  submitLabel,
  copy,
  initialBlocks,
}: RoutineStepProps) {
  const [blocks, setBlocks] = useState<RoutineBlockDraft[]>(
    initialBlocks.length
      ? initialBlocks
      : [{ startTime: "06:30", endTime: "07:00", activity: "", weekdays: [1, 2, 3, 4, 5] }]
  );

  const serialized = JSON.stringify(
    blocks.filter((b) => b.activity.trim() && b.weekdays.length > 0)
  );

  const toggleDay = (i: number, day: number) =>
    setBlocks((prev) =>
      prev.map((b, j) =>
        j === i
          ? {
              ...b,
              weekdays: b.weekdays.includes(day)
                ? b.weekdays.filter((d) => d !== day)
                : [...b.weekdays, day].sort(),
            }
          : b
      )
    );

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="data" value={serialized} />
      <h1 className="display-title text-3xl sm:text-4xl">{copy.routine.title}</h1>
      <p className="mt-2 opacity-75">{copy.routine.lead}</p>

      <ul className="flex flex-col gap-4 mt-6 list-none">
        {blocks.map((block, i) => (
          <li
            key={i}
            className="bg-white border-2 border-forest rounded-card shadow-hard p-4"
          >
            {/* One line even at 360px: narrow time inputs, no wrapping. */}
            <div className="flex items-center gap-1.5">
              <input
                aria-label={copy.routine.start}
                type="time"
                value={block.startTime}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, j) =>
                      j === i ? { ...b, startTime: e.target.value } : b
                    )
                  )
                }
                className={`${inputClass} font-mono min-w-0 flex-1 px-2`}
              />
              <span aria-hidden className="shrink-0 opacity-60">
                –
              </span>
              <input
                aria-label={copy.routine.end}
                type="time"
                value={block.endTime}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, j) =>
                      j === i ? { ...b, endTime: e.target.value } : b
                    )
                  )
                }
                className={`${inputClass} font-mono min-w-0 flex-1 px-2`}
              />
              {blocks.length > 1 && (
                <button
                  type="button"
                  aria-label={copy.routine.removeBlock}
                  onClick={() =>
                    setBlocks((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="min-h-[44px] min-w-[44px] shrink-0 inline-flex items-center justify-center rounded-lg border-2 border-forest bg-white"
                >
                  <X className="w-4 h-4" aria-hidden />
                </button>
              )}
            </div>
            <input
              placeholder={copy.routine.activityPlaceholder}
              aria-label={copy.routine.activity}
              value={block.activity}
              onChange={(e) =>
                setBlocks((prev) =>
                  prev.map((b, j) =>
                    j === i ? { ...b, activity: e.target.value } : b
                  )
                )
              }
              className={`${inputClass} mt-3`}
            />
            <div className="flex gap-1.5 mt-3 flex-wrap" role="group" aria-label={copy.routine.weekdays}>
              {copy.weekdays.map((label, wi) => {
                const day = wi + 1;
                const on = block.weekdays.includes(day);
                return (
                  <button
                    key={wi}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(i, day)}
                    className={`min-h-[44px] min-w-[44px] rounded-lg border-2 border-forest text-xs font-semibold ${
                      on ? "bg-clover text-white" : "bg-white text-forest"
                    }`}
                  >
                    {label[0]}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() =>
          setBlocks((prev) => [
            ...prev,
            { startTime: "12:00", endTime: "13:00", activity: "", weekdays: [1, 2, 3, 4, 5] },
          ])
        }
        className={`${ghostButton} mt-4`}
      >
        <Plus className="w-4 h-4 mr-1.5" aria-hidden />
        {copy.routine.addBlock}
      </button>

      <OnboardingFooter
        backHref={backHref}
        skipHref={skipHref}
        skipLabel={copy.skip}
        backLabel={copy.back}
        submitLabel={submitLabel}
      />
    </form>
  );
}
