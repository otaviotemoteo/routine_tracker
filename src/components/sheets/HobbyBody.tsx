"use client";

import { useEffect, useState } from "react";
import { asRecord, fieldClass, labelClass, type SheetBodyProps } from "./types";

export function HobbyBody({ initial, copy, onChange }: SheetBodyProps) {
  const initialRecord = asRecord(initial);
  const [activity, setActivity] = useState<string>(
    typeof initialRecord?.activity === "string" ? initialRecord.activity : ""
  );
  const [minutes, setMinutes] = useState<string>(
    typeof initialRecord?.minutes === "number" ? String(initialRecord.minutes) : ""
  );

  useEffect(() => {
    const details: Record<string, unknown> = {};
    if (activity.trim()) details.activity = activity.trim();
    if (minutes && Number.isFinite(Number(minutes))) {
      details.minutes = Number(minutes);
    }
    onChange(details);
  }, [activity, minutes, onChange]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="hobby-activity" className={labelClass}>
          {copy.hobby.activity}
        </label>
        <input
          id="hobby-activity"
          placeholder={copy.hobby.activityPlaceholder}
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          className={`${fieldClass} w-full`}
        />
      </div>
      <div>
        <label htmlFor="hobby-minutes" className={labelClass}>
          {copy.hobby.minutes}
        </label>
        <input
          id="hobby-minutes"
          type="number"
          min={0}
          inputMode="numeric"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className={`${fieldClass} font-mono max-w-[7rem]`}
        />
      </div>
    </div>
  );
}
