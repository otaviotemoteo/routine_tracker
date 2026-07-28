"use client";

import { useEffect, useState } from "react";
import { asRecord, fieldClass, labelClass, type SheetBodyProps } from "./types";

export function RoutineBody({ context, initial, copy, onChange }: SheetBodyProps) {
  const blocks = context.routineBlocks;
  const initialRecord = asRecord(initial);
  const [followed, setFollowed] = useState<number[]>(
    Array.isArray(initialRecord?.followed_block_ids)
      ? (initialRecord!.followed_block_ids as number[])
      : []
  );
  const [struggled, setStruggled] = useState<number>(
    typeof initialRecord?.struggled_block_id === "number"
      ? initialRecord.struggled_block_id
      : 0
  );
  const [note, setNote] = useState<string>(
    typeof initialRecord?.struggle_note === "string"
      ? initialRecord.struggle_note
      : ""
  );

  useEffect(() => {
    if (blocks.length === 0) {
      onChange(null);
      return;
    }
    onChange({
      followed_block_ids: followed,
      ...(struggled > 0 ? { struggled_block_id: struggled } : {}),
      ...(struggled > 0 && note.trim() ? { struggle_note: note.trim() } : {}),
    });
  }, [blocks.length, followed, struggled, note, onChange]);

  if (blocks.length === 0) {
    return <p className="opacity-75">{copy.routine.noBlocks}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className={labelClass}>{copy.routine.followed}</span>
        <ul className="flex flex-col gap-2 list-none">
          {blocks.map((b) => (
            <li key={b.id}>
              <label className="flex items-center gap-3 min-h-[44px] font-medium">
                <input
                  type="checkbox"
                  checked={followed.includes(b.id)}
                  onChange={(e) =>
                    setFollowed((prev) =>
                      e.target.checked
                        ? [...prev, b.id]
                        : prev.filter((id) => id !== b.id)
                    )
                  }
                  className="w-6 h-6 accent-clover"
                />
                <span className="font-mono text-xs opacity-70">
                  {b.startTime}
                </span>
                {b.activity}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <label htmlFor="struggled" className={labelClass}>
          {copy.routine.struggled}
        </label>
        <select
          id="struggled"
          value={struggled}
          onChange={(e) => setStruggled(Number(e.target.value))}
          className={`${fieldClass} w-full`}
        >
          <option value={0}>{copy.routine.none}</option>
          {blocks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.activity}
            </option>
          ))}
        </select>
      </div>
      {struggled > 0 && (
        <input
          placeholder={copy.routine.struggleNote}
          aria-label={copy.routine.struggleNote}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`${fieldClass} w-full`}
        />
      )}
    </div>
  );
}
