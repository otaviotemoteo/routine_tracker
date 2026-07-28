"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  fieldBase,
  ghostButton,
  inputClass,
  OnboardingFooter,
} from "./OnboardingChrome";
import type { PlannedExercise } from "@/db/schema";
import type { Copy } from "@/lib/i18n";

export interface WorkoutDayDraft {
  weekday: number;
  focus: string;
  exercises: PlannedExercise[];
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

const emptyExercise = (): PlannedExercise => ({ name: "" });

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
    initialDays.length
      ? initialDays
      : [{ weekday: 1, focus: "", exercises: [emptyExercise()] }]
  );

  // Only named exercises are saved; sets/reps stay optional.
  const serialized = JSON.stringify(
    days
      .filter((d) => d.focus.trim())
      .map((d) => ({
        weekday: d.weekday,
        focus: d.focus,
        exercises: d.exercises
          .filter((e) => e.name.trim())
          .map((e) => ({
            name: e.name.trim(),
            ...(e.sets ? { sets: e.sets } : {}),
            ...(e.reps ? { reps: e.reps } : {}),
          })),
      }))
  );

  const updateDay = (i: number, patch: Partial<WorkoutDayDraft>) =>
    setDays((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const updateExercise = (
    dayIndex: number,
    exIndex: number,
    patch: Partial<PlannedExercise>
  ) =>
    setDays((prev) =>
      prev.map((d, j) =>
        j === dayIndex
          ? {
              ...d,
              exercises: d.exercises.map((e, k) =>
                k === exIndex ? { ...e, ...patch } : e
              ),
            }
          : d
      )
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
                onChange={(e) => updateDay(i, { weekday: Number(e.target.value) })}
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
              onChange={(e) => updateDay(i, { focus: e.target.value })}
              className={`${inputClass} mt-3`}
            />

            <p className="mt-4 mb-2 font-semibold text-sm">
              {copy.workout.exercises}
            </p>
            <ul className="flex flex-col gap-2 list-none">
              {/* Name on its own row, then sets × reps — fits 360px without
                  crushing the name field. */}
              {day.exercises.map((ex, k) => (
                <li
                  key={k}
                  className="flex flex-col gap-2 border-t-2 border-dashed border-sand pt-2 first:border-t-0 first:pt-0"
                >
                  <input
                    placeholder={copy.workout.exerciseName}
                    aria-label={copy.workout.exerciseName}
                    value={ex.name}
                    onChange={(e) =>
                      updateExercise(i, k, { name: e.target.value })
                    }
                    className={inputClass}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      placeholder={copy.workout.sets}
                      aria-label={copy.workout.sets}
                      value={ex.sets ?? ""}
                      onChange={(e) =>
                        updateExercise(i, k, {
                          sets: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      className={`${fieldBase} font-mono w-20 px-2`}
                    />
                    <span aria-hidden className="opacity-60">
                      ×
                    </span>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      placeholder={copy.workout.reps}
                      aria-label={copy.workout.reps}
                      value={ex.reps ?? ""}
                      onChange={(e) =>
                        updateExercise(i, k, {
                          reps: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      className={`${fieldBase} font-mono w-20 px-2`}
                    />
                    {day.exercises.length > 1 && (
                      <button
                        type="button"
                        aria-label={copy.workout.removeExercise}
                        onClick={() =>
                          updateDay(i, {
                            exercises: day.exercises.filter((_, j) => j !== k),
                          })
                        }
                        className="min-h-[44px] min-w-[44px] ml-auto shrink-0 inline-flex items-center justify-center rounded-lg border-2 border-forest bg-white"
                      >
                        <X className="w-4 h-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                updateDay(i, { exercises: [...day.exercises, emptyExercise()] })
              }
              className={`${ghostButton} mt-3`}
            >
              <Plus className="w-4 h-4 mr-1.5" aria-hidden />
              {copy.workout.addExercise}
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() =>
          setDays((prev) => [
            ...prev,
            { weekday: 1, focus: "", exercises: [emptyExercise()] },
          ])
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
