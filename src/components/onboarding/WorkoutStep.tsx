"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  fieldBase,
  ghostButton,
  inputClass,
  OnboardingFooter,
  StepTitle,
} from "./OnboardingChrome";
import { CollapsedCard } from "./CollapsedCard";
import type { ExerciseKind, PlannedExercise } from "@/db/schema";
import { exerciseScheme } from "@/lib/exercise";
import { format, plural, type Copy } from "@/lib/i18n";

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
  requireDirtyToSave?: boolean;
  titleBackHref?: string;
}

const emptyExercise = (): PlannedExercise => ({ name: "", kind: "reps" });
const defaultDays = (): WorkoutDayDraft[] => [
  { weekday: 1, focus: "", exercises: [emptyExercise()] },
];

const KINDS: ExerciseKind[] = ["reps", "time", "distance"];

export function WorkoutStep({
  action,
  next,
  backHref,
  skipHref,
  submitLabel,
  copy,
  initialName,
  initialDays,
  requireDirtyToSave,
  titleBackHref,
}: WorkoutStepProps) {
  const [name, setName] = useState(initialName);
  const [days, setDays] = useState<WorkoutDayDraft[]>(
    initialDays.length ? initialDays : defaultDays()
  );
  // Only one day is expanded at a time; the rest fold into summaries. Start
  // with the last one open when there's existing data to extend.
  const [openIndex, setOpenIndex] = useState<number>(
    initialDays.length ? initialDays.length - 1 : 0
  );
  const [initialSnapshot] = useState(() =>
    JSON.stringify({
      name: initialName,
      days: initialDays.length ? initialDays : defaultDays(),
    })
  );
  const dirty = JSON.stringify({ name, days }) !== initialSnapshot;

  const kindLabel: Record<ExerciseKind, string> = {
    reps: copy.workout.kindReps,
    time: copy.workout.kindTime,
    distance: copy.workout.kindDistance,
  };

  const serialized = JSON.stringify(
    days
      .filter((d) => d.focus.trim())
      .map((d) => ({
        weekday: d.weekday,
        focus: d.focus,
        exercises: d.exercises
          .filter((e) => e.name.trim())
          .map((e) => {
            const kind = e.kind ?? "reps";
            return {
              name: e.name.trim(),
              kind,
              ...(e.sets ? { sets: e.sets } : {}),
              ...(kind === "reps" && e.reps ? { reps: e.reps } : {}),
              ...(kind === "time" && e.seconds ? { seconds: e.seconds } : {}),
              ...(kind === "distance" && e.distance
                ? { distance: e.distance }
                : {}),
              ...(kind === "distance" && e.minutes ? { minutes: e.minutes } : {}),
            };
          }),
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

  // The day after the last configured one, so a week fills in naturally.
  function addDay() {
    setDays((prev) => {
      const lastWeekday = prev.length ? prev[prev.length - 1].weekday : 0;
      const nextWeekday = (lastWeekday % 7) + 1;
      setOpenIndex(prev.length);
      return [
        ...prev,
        { weekday: nextWeekday, focus: "", exercises: [emptyExercise()] },
      ];
    });
  }

  function summaryFor(day: WorkoutDayDraft): string {
    const count = day.exercises.filter((e) => e.name.trim()).length;
    return format(
      plural(count, copy.workout.exerciseCount, copy.workout.exerciseCountPlural),
      { n: count }
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="data" value={serialized} />
      <StepTitle backHref={titleBackHref} backLabel={copy.back}>
        {copy.workout.title}
      </StepTitle>
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

      <ul className="flex flex-col gap-3 mt-6 list-none">
        {days.map((day, i) =>
          i !== openIndex && day.focus.trim() ? (
            <li key={i}>
              <CollapsedCard
                title={`${copy.weekdays[day.weekday - 1]} · ${day.focus}`}
                detail={summaryFor(day)}
                editLabel={copy.config.edit}
                onEdit={() => setOpenIndex(i)}
              />
            </li>
          ) : (
            <li
              key={i}
              className="bg-white border-2 border-forest rounded-card shadow-hard p-4"
            >
              <div className="flex items-center gap-3 justify-between">
                <select
                  aria-label={copy.workout.weekday}
                  value={day.weekday}
                  onChange={(e) =>
                    updateDay(i, { weekday: Number(e.target.value) })
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
                    onClick={() => {
                      setDays((prev) => prev.filter((_, j) => j !== i));
                      setOpenIndex((prev) => (prev > 0 ? prev - 1 : 0));
                    }}
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
                {day.exercises.map((ex, k) => {
                  const kind = ex.kind ?? "reps";
                  return (
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

                      {/* How this exercise is measured — a run has no reps. */}
                      <div
                        role="group"
                        aria-label={copy.workout.measuredBy}
                        className="flex gap-1.5"
                      >
                        {KINDS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={kind === option}
                            onClick={() => updateExercise(i, k, { kind: option })}
                            className={`min-h-[36px] px-3 rounded-lg border-2 border-forest text-xs font-semibold ${
                              kind === option
                                ? "bg-clover text-white"
                                : "bg-white text-forest"
                            }`}
                          >
                            {kindLabel[option]}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        {kind !== "distance" && (
                          <>
                            <input
                              type="number"
                              min={1}
                              inputMode="numeric"
                              placeholder={copy.workout.sets}
                              aria-label={copy.workout.sets}
                              value={ex.sets ?? ""}
                              onChange={(e) =>
                                updateExercise(i, k, {
                                  sets: e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                })
                              }
                              className={`${fieldBase} font-mono w-20 px-2`}
                            />
                            <span aria-hidden className="opacity-60">
                              ×
                            </span>
                          </>
                        )}

                        {kind === "reps" && (
                          <input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            placeholder={copy.workout.reps}
                            aria-label={copy.workout.reps}
                            value={ex.reps ?? ""}
                            onChange={(e) =>
                              updateExercise(i, k, {
                                reps: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              })
                            }
                            className={`${fieldBase} font-mono w-20 px-2`}
                          />
                        )}

                        {kind === "time" && (
                          <input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            placeholder={copy.workout.seconds}
                            aria-label={copy.workout.seconds}
                            value={ex.seconds ?? ""}
                            onChange={(e) =>
                              updateExercise(i, k, {
                                seconds: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              })
                            }
                            className={`${fieldBase} font-mono w-24 px-2`}
                          />
                        )}

                        {kind === "distance" && (
                          <>
                            <input
                              type="number"
                              min={0}
                              step="0.1"
                              inputMode="decimal"
                              placeholder={copy.workout.distance}
                              aria-label={copy.workout.distance}
                              value={ex.distance ?? ""}
                              onChange={(e) =>
                                updateExercise(i, k, {
                                  distance: e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                })
                              }
                              className={`${fieldBase} font-mono w-20 px-2`}
                            />
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              placeholder={copy.workout.minutes}
                              aria-label={copy.workout.minutes}
                              value={ex.minutes ?? ""}
                              onChange={(e) =>
                                updateExercise(i, k, {
                                  minutes: e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                })
                              }
                              className={`${fieldBase} font-mono w-24 px-2`}
                            />
                          </>
                        )}

                        {day.exercises.length > 1 && (
                          <button
                            type="button"
                            aria-label={copy.workout.removeExercise}
                            onClick={() =>
                              updateDay(i, {
                                exercises: day.exercises.filter(
                                  (_, j) => j !== k
                                ),
                              })
                            }
                            className="min-h-[44px] min-w-[44px] ml-auto shrink-0 inline-flex items-center justify-center rounded-lg border-2 border-forest bg-white"
                          >
                            <X className="w-4 h-4" aria-hidden />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
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
          )
        )}
      </ul>

      <button type="button" onClick={addDay} className={`${ghostButton} mt-4`}>
        <Plus className="w-4 h-4 mr-1.5" aria-hidden />
        {copy.workout.addDay}
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
