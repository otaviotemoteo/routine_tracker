"use client";

import { useEffect, useState } from "react";
import { asRecord, type SheetBodyProps } from "./types";

// The check-in step for the Checklist card style: tick off whichever of the
// activity's own named items (activities.config.items, set once from the
// chooser) got done today. There is no target and no unit here — a checklist
// activity's only question is "which ones", same as the legacy `rotina` body
// asks of its routine blocks.
export function ChecklistBody({ initial, copy, activity, onChange }: SheetBodyProps) {
  const configRecord = asRecord(activity.config);
  const items = Array.isArray(configRecord?.items)
    ? configRecord!.items.filter((i): i is string => typeof i === "string")
    : [];

  const initialRecord = asRecord(initial);
  const initialDone = Array.isArray(initialRecord?.done_items)
    ? (initialRecord!.done_items as unknown[]).filter(
        (i): i is string => typeof i === "string"
      )
    : [];

  const [done, setDone] = useState<Set<string>>(new Set(initialDone));

  useEffect(() => {
    // Every item still counts even at zero ticked — details is the day's
    // real answer ("none of them, today"), not "nothing to save".
    onChange({ done_items: Array.from(done) });
  }, [done, onChange]);

  function toggle(item: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <div>
        <p className="font-semibold">{copy.checklist.noItems}</p>
        <p className="text-sm opacity-75 mt-1">{copy.checklist.noItemsHint}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5 list-none">
      {items.map((item) => {
        const checked = done.has(item);
        return (
          <li key={item}>
            <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(item)}
                className="w-5 h-5 shrink-0 accent-clover"
              />
              <span
                className={`font-semibold ${checked ? "" : "opacity-75"}`}
              >
                {item}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
