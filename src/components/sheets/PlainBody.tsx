"use client";

import { useEffect, useState } from "react";
import { asRecord, fieldClass, labelClass, type SheetBodyProps } from "./types";
import { format } from "@/lib/i18n";

// The check-in step for an activity with no template — which, after the
// remodel, is every activity anyone creates.
//
// The seven original bodies each ask a question shaped by their area: which
// exercises, which book and page, how many hours. This one has only the
// activity's own metric to go on, so it asks the one question that metric
// supports and nothing else. That is the point rather than a limitation:
// the daily check-in has to stay under two minutes, and a generic form that
// invented extra fields would spend that budget on nothing.
export function PlainBody({ initial, copy, activity, onChange }: SheetBodyProps) {
  const initialRecord = asRecord(initial);
  const initialValue =
    typeof initialRecord?.value === "number" ? initialRecord.value : null;

  // Binary habits are answered by the step's own Save (which flips `done`), so
  // the only state here is the number — and for binary there isn't one.
  const [value, setValue] = useState<string>(
    initialValue === null ? "" : String(initialValue)
  );

  const isBinary = activity.metricType === "binary";

  useEffect(() => {
    if (isBinary) {
      // Still emit a value so the day has a figure to render: 1 means the
      // step was saved, and the shell only saves when the user says done.
      onChange({ value: 1 });
      return;
    }
    const n = Number(value);
    // An empty or unparseable box is "no figure given", not zero — the shell
    // treats null as nothing to save and leaves the spine alone.
    onChange(value !== "" && Number.isFinite(n) && n >= 0 ? { value: n } : null);
  }, [value, isBinary, onChange]);

  if (isBinary) {
    return (
      <p className="opacity-75">
        {activity.minimalAction
          ? format(copy.plain.binaryWithMinimal, {
              action: activity.minimalAction,
            })
          : copy.plain.binary}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="plain-value" className={labelClass}>
          {activity.unit
            ? format(copy.plain.valueWithUnit, { unit: activity.unit })
            : copy.plain.value}
        </label>
        <input
          id="plain-value"
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`${fieldClass} font-mono max-w-[7rem]`}
        />
        {/* The target is shown, never enforced: falling short of it is data,
            not an error, and a form that scolds is one people stop filling. */}
        {activity.target !== null && (
          <p className="mt-1.5 text-sm opacity-75">
            {format(copy.plain.target, {
              n: activity.target,
              unit: activity.unit ?? "",
            }).trim()}
          </p>
        )}
      </div>
      {activity.minimalAction && (
        <p className="text-sm opacity-75">
          {format(copy.plain.minimal, { action: activity.minimalAction })}
        </p>
      )}
    </div>
  );
}
