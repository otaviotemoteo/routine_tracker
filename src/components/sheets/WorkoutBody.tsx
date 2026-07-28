"use client";

import { useEffect, useState } from "react";
import { asRecord, labelClass, type SheetBodyProps } from "./types";

interface ExerciseState {
  name: string;
  done: boolean;
}

export function WorkoutBody({ context, initial, copy, onChange }: SheetBodyProps) {
  const day = context.plan?.day ?? null;
  const initialRecord = asRecord(initial);
  const initialCompleted = Array.isArray(initialRecord?.completed)
    ? (initialRecord!.completed as { name: string; done: boolean }[])
    : [];

  const [exercises, setExercises] = useState<ExerciseState[]>(
    (day?.exercises ?? []).map((e) => ({
      name: e.name,
      done: initialCompleted.find((c) => c.name === e.name)?.done ?? false,
    }))
  );
  const [effort, setEffort] = useState<number>(
    typeof initialRecord?.effort === "number" ? initialRecord.effort : 0
  );

  useEffect(() => {
    if (!day) {
      onChange(null);
      return;
    }
    onChange({
      plan_day_id: day.id,
      completed: exercises.map((e) => ({ name: e.name, done: e.done })),
      ...(effort > 0 ? { effort } : {}),
    });
  }, [day, exercises, effort, onChange]);

  if (!day) {
    return <p className="opacity-75">{copy.workout.noPlan}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-semibold">
        {copy.workout.plan}: <span className="text-clover">{day.focus}</span>
      </p>
      <ul className="flex flex-col gap-2 list-none">
        {exercises.map((ex, i) => (
          <li key={i}>
            <label className="flex items-center gap-3 min-h-[44px] font-medium">
              <input
                type="checkbox"
                checked={ex.done}
                onChange={(e) =>
                  setExercises((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, done: e.target.checked } : x
                    )
                  )
                }
                className="w-6 h-6 accent-clover"
              />
              {ex.name}
            </label>
          </li>
        ))}
      </ul>
      <div>
        <span className={labelClass}>{copy.workout.effort}</span>
        <div className="flex gap-2" role="group" aria-label={copy.workout.effort}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={effort === n}
              onClick={() => setEffort((prev) => (prev === n ? 0 : n))}
              className={`min-h-[44px] min-w-[44px] rounded-lg border-2 border-forest font-mono font-bold ${
                effort >= n ? "bg-clover text-white" : "bg-white text-forest"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
