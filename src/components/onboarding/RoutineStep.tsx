"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  ghostButton,
  inputClass,
  OnboardingFooter,
  StepTitle,
} from "./OnboardingChrome";
import { CollapsedCard } from "./CollapsedCard";
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
  requireDirtyToSave?: boolean;
  titleBackHref?: string;
}

const defaultBlocks = (): RoutineBlockDraft[] => [
  { startTime: "06:30", endTime: "07:00", activity: "", weekdays: [1, 2, 3, 4, 5] },
];

// "08:00" → 480. Used to keep end after start and each block after the last.
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
}

function addMinutes(time: string, delta: number): string {
  const total = Math.min(23 * 60 + 59, toMinutes(time) + delta);
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function RoutineStep({
  action,
  next,
  backHref,
  skipHref,
  submitLabel,
  copy,
  initialBlocks,
  requireDirtyToSave,
  titleBackHref,
}: RoutineStepProps) {
  const [blocks, setBlocks] = useState<RoutineBlockDraft[]>(
    initialBlocks.length ? initialBlocks : defaultBlocks()
  );
  const [openIndex, setOpenIndex] = useState<number>(
    initialBlocks.length ? initialBlocks.length - 1 : 0
  );
  const [initialSnapshot] = useState(() =>
    JSON.stringify(initialBlocks.length ? initialBlocks : defaultBlocks())
  );
  const dirty = JSON.stringify(blocks) !== initialSnapshot;

  const serialized = JSON.stringify(
    blocks.filter((b) => b.activity.trim() && b.weekdays.length > 0)
  );

  const update = (i: number, patch: Partial<RoutineBlockDraft>) =>
    setBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));

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

  // A new block picks up where the last one ended, so a day chains together.
  function addBlock() {
    setBlocks((prev) => {
      const lastEnd = prev.length ? prev[prev.length - 1].endTime : "08:00";
      setOpenIndex(prev.length);
      return [
        ...prev,
        {
          startTime: lastEnd,
          endTime: addMinutes(lastEnd, 30),
          activity: "",
          weekdays: [1, 2, 3, 4, 5],
        },
      ];
    });
  }

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="data" value={serialized} />
      <StepTitle backHref={titleBackHref} backLabel={copy.back}>
        {copy.routine.title}
      </StepTitle>
      <p className="mt-2 opacity-75">{copy.routine.lead}</p>

      <ul className="flex flex-col gap-3 mt-6 list-none">
        {blocks.map((block, i) =>
          i !== openIndex && block.activity.trim() ? (
            <li key={i}>
              <CollapsedCard
                title={`${block.startTime} – ${block.endTime} · ${block.activity}`}
                detail={block.weekdays
                  .map((d) => copy.weekdays[d - 1])
                  .join(", ")}
                editLabel={copy.config.edit}
                onEdit={() => setOpenIndex(i)}
              />
            </li>
          ) : (
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
                  // Can't start before the previous block ends.
                  min={i > 0 ? blocks[i - 1].endTime : undefined}
                  onChange={(e) => {
                    const startTime = e.target.value;
                    update(i, {
                      startTime,
                      // Keep the end after the start.
                      ...(toMinutes(block.endTime) <= toMinutes(startTime)
                        ? { endTime: addMinutes(startTime, 30) }
                        : {}),
                    });
                  }}
                  className={`${inputClass} font-mono min-w-0 flex-1 px-2`}
                />
                <span aria-hidden className="shrink-0 opacity-60">
                  –
                </span>
                <input
                  aria-label={copy.routine.end}
                  type="time"
                  value={block.endTime}
                  min={block.startTime}
                  onChange={(e) => update(i, { endTime: e.target.value })}
                  className={`${inputClass} font-mono min-w-0 flex-1 px-2`}
                />
                {blocks.length > 1 && (
                  <button
                    type="button"
                    aria-label={copy.routine.removeBlock}
                    onClick={() => {
                      setBlocks((prev) => prev.filter((_, j) => j !== i));
                      setOpenIndex((prev) => (prev > 0 ? prev - 1 : 0));
                    }}
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
                onChange={(e) => update(i, { activity: e.target.value })}
                className={`${inputClass} mt-3`}
              />
              <div
                className="flex gap-1.5 mt-3 flex-wrap"
                role="group"
                aria-label={copy.routine.weekdays}
              >
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
          )
        )}
      </ul>

      <button type="button" onClick={addBlock} className={`${ghostButton} mt-4`}>
        <Plus className="w-4 h-4 mr-1.5" aria-hidden />
        {copy.routine.addBlock}
      </button>

      <OnboardingFooter
        backHref={backHref}
        skipHref={skipHref}
        skipLabel={copy.skip}
        backLabel={copy.back}
        submitLabel={submitLabel}
        copy={copy}
        dirty={dirty}
        requireDirtyToSave={requireDirtyToSave}
      />
    </form>
  );
}
