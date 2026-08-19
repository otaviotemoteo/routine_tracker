"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlarmClock,
  BookOpen,
  Church,
  Dumbbell,
  Globe,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { primaryButton } from "@/components/ui/styles";
import { format, type Copy } from "@/lib/i18n";
import type { ProposableKind } from "@/lib/ai/activity-proposer";
import type { HabitRow } from "@/db/habits";

const KIND_ICONS: Record<ProposableKind, LucideIcon> = {
  treino: Dumbbell,
  leitura: BookOpen,
  rotina: AlarmClock,
  duolingo: Globe,
  espiritualidade: Church,
};

interface ActivityKindPickerProps {
  habits: HabitRow[];
  copy: Copy["activities"];
  action: (formData: FormData) => void;
}

// One card per still-plain habit, five icon-buttons each — pick which kind
// of activity set this habit is made of. A single press elsewhere (Generate)
// then runs ONE batched call for every pick at once (see
// generateActivitiesAction) — this component only ever collects the picks,
// it never calls the generator itself, so there is exactly one submit for
// however many habits are chosen.
export function ActivityKindPicker({
  habits,
  copy,
  action,
}: ActivityKindPickerProps) {
  const [picks, setPicks] = useState<Record<number, ProposableKind | null>>({});

  const kinds: { kind: ProposableKind; label: string }[] = [
    { kind: "treino", label: copy.kindWorkout },
    { kind: "leitura", label: copy.kindReading },
    { kind: "rotina", label: copy.kindRoutine },
    { kind: "duolingo", label: copy.kindLanguages },
    { kind: "espiritualidade", label: copy.kindSpirituality },
  ];

  const picksJson = JSON.stringify(
    Object.entries(picks)
      .filter((entry): entry is [string, ProposableKind] => entry[1] !== null)
      .map(([habitId, kind]) => ({ habitId: Number(habitId), kind }))
  );
  const anyPicked = Object.values(picks).some((k) => k !== null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="picks" value={picksJson} />
      <ul className="flex flex-col gap-3 list-none">
        {habits.map((habit) => (
          <li
            key={habit.id}
            className="border-2 border-forest rounded-card bg-white shadow-hard p-4"
          >
            <p className="font-semibold mb-2.5">{habit.name}</p>
            <div className="flex gap-2 flex-wrap" role="group" aria-label={habit.name}>
              {kinds.map(({ kind, label }) => {
                const Icon = KIND_ICONS[kind];
                const chosen = picks[habit.id] === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={chosen}
                    aria-label={format(copy.pick, { kind: label })}
                    title={label}
                    onClick={() =>
                      setPicks((prev) => ({
                        ...prev,
                        [habit.id]: prev[habit.id] === kind ? null : kind,
                      }))
                    }
                    className={`w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-lg border-2 shadow-hard-sm transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 ${
                      chosen ? "border-clover bg-mint" : "border-forest bg-white"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${chosen ? "text-clover" : ""}`}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <SubmitButton
        label={copy.generate}
        savingLabel={copy.generating}
        disabled={!anyPicked}
      />
    </form>
  );
}

function SubmitButton({
  label,
  savingLabel,
  disabled,
}: {
  label: string;
  savingLabel: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`${primaryButton} w-full sm:w-auto`}
    >
      {pending && (
        <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />
      )}
      {pending ? savingLabel : label}
    </button>
  );
}
