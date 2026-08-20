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

interface Pick {
  kind: ProposableKind | null;
  briefing: string;
}

// One card per still-plain habit: a free-text briefing — "escreva
// brevemente uma ação que você gostaria de fazer aqui" — plus five
// icon-buttons for which kind of activity set it's made of. The briefing is
// the context that closes the "onboarding-time calls have no why" gap: a
// good umbrella habit plus a real briefing makes for an assertive activity
// instead of a generic one. See docs/ARCHITECTURE.md.
//
// A single press elsewhere (Generate) runs ONE batched call for every pick
// at once (see generateActivitiesAction) — this component only ever
// collects the picks, it never calls the generator itself.
export function ActivityKindPicker({
  habits,
  copy,
  action,
}: ActivityKindPickerProps) {
  const [picks, setPicks] = useState<Record<number, Pick>>({});

  const kinds: { kind: ProposableKind; label: string }[] = [
    { kind: "treino", label: copy.kindWorkout },
    { kind: "leitura", label: copy.kindReading },
    { kind: "rotina", label: copy.kindRoutine },
    { kind: "duolingo", label: copy.kindLanguages },
    { kind: "espiritualidade", label: copy.kindSpirituality },
  ];

  const picksJson = JSON.stringify(
    Object.entries(picks)
      .filter((entry): entry is [string, Pick & { kind: ProposableKind }] =>
        entry[1].kind !== null
      )
      .map(([habitId, p]) => ({
        habitId: Number(habitId),
        kind: p.kind,
        briefing: p.briefing.trim() || null,
      }))
  );
  const anyPicked = Object.values(picks).some((p) => p.kind !== null);

  function setKind(habitId: number, kind: ProposableKind) {
    setPicks((prev) => {
      const current = prev[habitId] ?? { kind: null, briefing: "" };
      return {
        ...prev,
        [habitId]: { ...current, kind: current.kind === kind ? null : kind },
      };
    });
  }

  function setBriefing(habitId: number, briefing: string) {
    setPicks((prev) => ({
      ...prev,
      [habitId]: { kind: prev[habitId]?.kind ?? null, briefing },
    }));
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="picks" value={picksJson} />
      <ul className="flex flex-col gap-3 list-none">
        {habits.map((habit) => {
          const pick = picks[habit.id] ?? { kind: null, briefing: "" };
          return (
            <li
              key={habit.id}
              className="border-2 border-forest rounded-card bg-white shadow-hard p-4"
            >
              <p className="font-semibold mb-2.5">{habit.name}</p>

              <label
                htmlFor={`briefing-${habit.id}`}
                className="block mb-1.5 text-sm font-semibold"
              >
                {copy.briefingLabel}
              </label>
              <textarea
                id={`briefing-${habit.id}`}
                rows={2}
                placeholder={copy.briefingPlaceholder}
                value={pick.briefing}
                onChange={(e) => setBriefing(habit.id, e.target.value)}
                className="w-full mb-3 px-3 py-2 border-2 border-forest rounded-lg bg-cream focus:bg-white min-h-[52px]"
              />

              <div className="flex gap-2 flex-wrap" role="group" aria-label={habit.name}>
                {kinds.map(({ kind, label }) => {
                  const Icon = KIND_ICONS[kind];
                  const chosen = pick.kind === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={chosen}
                      aria-label={format(copy.pick, { kind: label })}
                      onClick={() => setKind(habit.id, kind)}
                      className={`shrink-0 inline-flex flex-col items-center gap-1 px-2.5 py-2 rounded-lg border-2 shadow-hard-sm transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 ${
                        chosen ? "border-clover bg-mint" : "border-forest bg-white"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${chosen ? "text-clover" : ""}`}
                        aria-hidden
                      />
                      <span
                        className={`text-[0.6rem] font-semibold leading-none ${
                          chosen ? "text-clover" : "opacity-70"
                        }`}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
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
