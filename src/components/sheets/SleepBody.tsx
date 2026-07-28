"use client";

import { useEffect, useState } from "react";
import { asRecord, fieldClass, labelClass, type SheetBodyProps } from "./types";

// Default hours from the configured bedtime → wake window (rounded to 0.5).
function durationHours(bed?: string, wake?: string): number {
  if (!bed || !wake) return 8;
  const [bh, bm] = bed.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 2) / 2;
}

export function SleepBody({ context, initial, copy, onChange }: SheetBodyProps) {
  const initialRecord = asRecord(initial);
  const defaultHours = durationHours(
    context.sleepTarget?.bedtime,
    context.sleepTarget?.wakeTime
  );
  const [hours, setHours] = useState<string>(
    typeof initialRecord?.hours === "number"
      ? String(initialRecord.hours)
      : String(defaultHours)
  );
  const [wokeUp, setWokeUp] = useState<boolean>(
    initialRecord?.woke_up_at_night === true
  );
  const [quality, setQuality] = useState<number>(
    typeof initialRecord?.quality === "number" ? initialRecord.quality : 0
  );

  const hoursNum = Number(hours);

  useEffect(() => {
    onChange({
      hours: Number.isFinite(hoursNum) ? hoursNum : 0,
      woke_up_at_night: wokeUp,
      ...(quality > 0 ? { quality } : {}),
    });
  }, [hoursNum, wokeUp, quality, onChange]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="sleep-hours" className={labelClass}>
          {copy.sleep.hours}
        </label>
        <input
          id="sleep-hours"
          type="number"
          min={0}
          max={24}
          step={0.5}
          inputMode="decimal"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className={`${fieldClass} font-mono max-w-[7rem]`}
        />
      </div>
      <label className="flex items-center gap-3 min-h-[44px] font-medium">
        <input
          type="checkbox"
          checked={wokeUp}
          onChange={(e) => setWokeUp(e.target.checked)}
          className="w-6 h-6 accent-clover"
        />
        {copy.sleep.wokeUp}
      </label>
      <div>
        <span className={labelClass}>{copy.sleep.quality}</span>
        <div className="flex gap-2" role="group" aria-label={copy.sleep.quality}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={quality === n}
              onClick={() => setQuality((prev) => (prev === n ? 0 : n))}
              className={`min-h-[44px] min-w-[44px] rounded-lg border-2 border-forest font-mono font-bold ${
                quality >= n ? "bg-clover text-white" : "bg-white text-forest"
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
