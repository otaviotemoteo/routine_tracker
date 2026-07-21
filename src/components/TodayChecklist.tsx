"use client";

import { useCallback, useState } from "react";
import { CircleAlert } from "lucide-react";
import { HabitCard } from "@/components/HabitCard";
import type { CheckWithHabit } from "@/types/habit";

interface TodayChecklistProps {
  initialChecks: CheckWithHabit[];
}

// Owns the day's check state so the progress bar updates in the same
// optimistic beat as the card toggles.
export function TodayChecklist({ initialChecks }: TodayChecklistProps) {
  const [checks, setChecks] = useState(initialChecks);
  const [saveError, setSaveError] = useState(false);

  const toggle = useCallback(async (id: number, done: boolean) => {
    setSaveError(false);
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, done } : c)));
    try {
      const res = await fetch(`/api/checks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
    } catch {
      // Rollback the optimistic flip.
      setChecks((prev) =>
        prev.map((c) => (c.id === id ? { ...c, done: !done } : c))
      );
      setSaveError(true);
    }
  }, []);

  const required = checks.filter((c) => !c.optional);
  const doneCount = required.filter((c) => c.done).length;
  const percent =
    required.length === 0
      ? 0
      : Math.round((doneCount / required.length) * 100);
  const allDone = required.length > 0 && doneCount === required.length;

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Progresso do dia"
        className="bg-white border-2 border-forest rounded-card shadow-hard px-5 py-4"
      >
        <div className="flex justify-between items-baseline font-semibold mb-2.5">
          <span>{allDone ? "Dia completo" : "Progresso"}</span>
          <span className="font-mono font-bold text-sm">
            {doneCount}/{required.length} · {percent}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={required.length}
          aria-label="Hábitos obrigatórios concluídos hoje"
          className="h-4 border-2 border-forest rounded-full bg-sand overflow-hidden"
        >
          <div
            className={`h-full bg-clover transition-[width] duration-300 ${
              percent > 0 && percent < 100 ? "border-r-2 border-forest" : ""
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        {doneCount === 0 && (
          <p className="text-sm opacity-75 mt-2.5">
            Toque em um card para marcar o primeiro hábito do dia.
          </p>
        )}
      </section>

      {saveError && (
        <p
          role="alert"
          className="flex items-center gap-2 text-sm font-semibold bg-white border-2 border-forest rounded-card shadow-hard px-4 py-3"
        >
          <CircleAlert aria-hidden className="w-5 h-5 text-straw shrink-0" />
          Não deu para salvar. Confira a conexão e toque de novo.
        </p>
      )}

      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4 list-none">
        {checks.map((check) => (
          <li key={check.id} className="contents">
            <HabitCard check={check} onToggle={toggle} />
          </li>
        ))}
      </ul>
    </div>
  );
}
