"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  ghostButton,
  inputClass,
  OnboardingFooter,
} from "./OnboardingChrome";
import type { Copy } from "@/lib/i18n";

export interface WorkoutDayDraft {
  weekday: number;
  focus: string;
  exercises: string; // one per line: "name; sets; reps; load"
}

interface WorkoutStepProps {
  action: (formData: FormData) => Promise<void>;
  next: string;
  backHref?: string;
  skipHref?: string;
  submitLabel: string;
  copy: Copy["onboarding"];
  initialName: string;
  initialDays: WorkoutDayDraft[];
}

function parseExercises(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, sets, reps, load] = line.split(";").map((s) => s.trim());
      const ex: { name: string; sets?: number; reps?: number; load?: string } = {
        name,
      };
      if (sets && !Number.isNaN(Number(sets))) ex.sets = Number(sets);
      if (reps && !Number.isNaN(Number(reps))) ex.reps = Number(reps);
      if (load) ex.load = load;
      return ex;
    });
}

export function WorkoutStep({
  action,
  next,
  backHref,
  skipHref,
  submitLabel,
  copy,
  initialName,
  initialDays,
}: WorkoutStepProps) {
  const [name, setName] = useState(initialName);
  const [days, setDays] = useState<WorkoutDayDraft[]>(
    initialDays.length ? initialDays : [{ weekday: 1, focus: "", exercises: "" }]
  );

  const serialized = JSON.stringify(
    days
      .filter((d) => d.focus.trim())
      .map((d) => ({
        weekday: d.weekday,
        focus: d.focus,
        exercises: parseExercises(d.exercises),
      }))
  );

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="data" value={serialized} />
      <h1 className="display-title text-3xl sm:text-4xl">{copy.workout.title}</h1>
      <p className="mt-2 opacity-75">{copy.workout.lead}</p>

      <label className="block mt-6 mb-1.5 font-semibold text-sm">
        {copy.workout.planName}
      </label>
      <input
        name="planName"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
      />

      <ul className="flex flex-col gap-4 mt-6 list-none">
        {days.map((day, i) => (
          <li
            key={i}
            className="bg-white border-2 border-forest rounded-card shadow-hard p-4"
          >
            <div className="flex items-center gap-3 justify-between">
              <select
                aria-label={copy.workout.weekday}
                value={day.weekday}
                onChange={(e) =>
                  setDays((prev) =>
                    prev.map((d, j) =>
                      j === i ? { ...d, weekday: Number(e.target.value) } : d
                    )
                  )
                }
                className={`${inputClass} max-w-[9rem]`}
              >
                {copy.weekdays.map((label, wi) => (
                  <option key={wi} value={wi + 1}>
                    {label}
                  </option>
                ))}
              </select>
              {days.length > 1 && (
                <button
                  type="button"
                  aria-label={copy.workout.removeDay}
                  onClick={() =>
                    setDays((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border-2 border-forest bg-white"
                >
                  <X className="w-4 h-4" aria-hidden />
                </button>
              )}
            </div>
            <input
              placeholder={copy.workout.focusPlaceholder}
              aria-label={copy.workout.focus}
              value={day.focus}
              onChange={(e) =>
                setDays((prev) =>
                  prev.map((d, j) => (j === i ? { ...d, focus: e.target.value } : d))
                )
              }
              className={`${inputClass} mt-3`}
            />
            <textarea
              placeholder={copy.workout.exercisesHint}
              aria-label={copy.workout.exercises}
              value={day.exercises}
              onChange={(e) =>
                setDays((prev) =>
                  prev.map((d, j) =>
                    j === i ? { ...d, exercises: e.target.value } : d
                  )
                )
              }
              rows={3}
              className={`${inputClass} mt-3 py-2 min-h-[72px]`}
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() =>
          setDays((prev) => [...prev, { weekday: 1, focus: "", exercises: "" }])
        }
        className={`${ghostButton} mt-4`}
      >
        <Plus className="w-4 h-4 mr-1.5" aria-hidden />
        {copy.workout.addDay}
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
