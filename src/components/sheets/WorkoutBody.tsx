"use client";

import { useEffect, useState } from "react";
import { exerciseScheme } from "@/lib/exercise";
import { asRecord, fieldClass, labelClass, type SheetBodyProps } from "./types";

export function WorkoutBody({ context, initial, copy, onChange }: SheetBodyProps) {
  const plan = context.plan;
  const plannedDay = plan?.day ?? null;
  const initialRecord = asRecord(initial);
  const initialCompleted = Array.isArray(initialRecord?.completed)
    ? (initialRecord!.completed as { name: string; done: boolean }[])
    : [];

  // Reality beats the plan: you may have trained something other than what
  // today's schedule says (or trained at all on a rest day).
  const [dayId, setDayId] = useState<number | null>(
    typeof initialRecord?.plan_day_id === "number"
      ? initialRecord.plan_day_id
      : (plannedDay?.id ?? null)
  );
  const day = plan?.days.find((d) => d.id === dayId) ?? null;
  const swapped = dayId !== (plannedDay?.id ?? null);
  const [showPicker, setShowPicker] = useState(swapped);

  const [doneByName, setDoneByName] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialCompleted.map((c) => [c.name, c.done]))
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
      completed: day.exercises.map((e) => ({
        name: e.name,
        done: doneByName[e.name] ?? false,
      })),
      ...(effort > 0 ? { effort } : {}),
    });
  }, [day, doneByName, effort, onChange]);

  // No plan at all — distinct from "a plan exists, just not today", which
  // is the branch below (line ~59) with its own, today-scoped copy.
  if (!plan || plan.days.length === 0) {
    return <p className="opacity-75">{copy.workout.notConfigured}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {day ? (
        <p className="font-semibold">
          {copy.workout.plan}: <span className="text-clover">{day.focus}</span>
        </p>
      ) : (
        <p className="opacity-75">{copy.workout.noPlan}</p>
      )}

      {day && (
        <>
          <ul className="flex flex-col gap-2 list-none">
            {day.exercises.map((ex, i) => {
              const scheme = exerciseScheme(ex);
              return (
                <li key={`${ex.name}-${i}`}>
                  <label className="flex items-center gap-3 min-h-[44px] font-medium">
                    <input
                      type="checkbox"
                      checked={doneByName[ex.name] ?? false}
                      onChange={(e) =>
                        setDoneByName((prev) => ({
                          ...prev,
                          [ex.name]: e.target.checked,
                        }))
                      }
                      className="w-6 h-6 accent-clover"
                    />
                    {ex.name}
                    {scheme && (
                      <span className="font-mono text-sm opacity-60">
                        {scheme}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>

          <div>
            <span className={labelClass}>{copy.workout.effort}</span>
            <div
              className="flex gap-2"
              role="group"
              aria-label={copy.workout.effort}
            >
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
        </>
      )}

      <div className="border-t-2 border-dashed border-sand pt-3">
        <label className="flex items-center gap-2 min-h-[44px] text-sm font-semibold">
          <input
            type="checkbox"
            checked={showPicker}
            onChange={(e) => {
              setShowPicker(e.target.checked);
              if (!e.target.checked) setDayId(plannedDay?.id ?? null);
            }}
            className="w-5 h-5 accent-clover"
          />
          {copy.workout.otherTraining}
        </label>
        {showPicker && (
          <select
            aria-label={copy.workout.pickTraining}
            value={dayId ?? ""}
            onChange={(e) =>
              setDayId(e.target.value ? Number(e.target.value) : null)
            }
            className={`${fieldClass} w-full mt-2`}
          >
            <option value="">{copy.workout.restLabel}</option>
            {plan.days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.focus}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
