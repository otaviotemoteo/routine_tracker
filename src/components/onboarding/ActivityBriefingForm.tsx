"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2 } from "lucide-react";
import { primaryButton } from "@/components/ui/styles";
import { domainIcon } from "@/lib/domain-icons";
import { isDomainSlug } from "@/lib/domains";
import { ASSESSMENT_COPY } from "@/lib/i18n-assessment";
import { format, type Copy, type Lang } from "@/lib/i18n";
import type { HabitRow } from "@/db/habits";

interface ActivityBriefingFormProps {
  habits: HabitRow[];
  lang: Lang;
  copy: Copy["activities"];
  action: (formData: FormData) => void;
}

// Screen 3 — one card per still-plain habit, a single free-text briefing
// each: "escreva brevemente uma ação que você gostaria de fazer aqui". No
// kind to pick any more — the model chooses it from the briefing (and the
// habit's own name/why) once Generate runs; see activity-proposer.ts. This
// component only ever collects the briefings, it never calls the generator
// itself (generateActivitiesAction does, one call per habit — see
// propose-activities.ts).
export function ActivityBriefingForm({
  habits,
  lang,
  copy,
  action,
}: ActivityBriefingFormProps) {
  const [briefings, setBriefings] = useState<Record<number, string>>({});
  const answered = Object.values(briefings).filter((b) => b.trim()).length;

  const picksJson = JSON.stringify(
    habits.map((h) => ({
      habitId: h.id,
      briefing: (briefings[h.id] ?? "").trim() || null,
    }))
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="picks" value={picksJson} />
      <ul className="flex flex-col gap-3.5 list-none">
        {habits.map((habit) => {
          const domain =
            habit.domainSlug && isDomainSlug(habit.domainSlug)
              ? ASSESSMENT_COPY[lang].domains[habit.domainSlug]
              : null;
          const Icon = habit.domainSlug && isDomainSlug(habit.domainSlug)
            ? domainIcon(habit.domainSlug)
            : null;
          const value = briefings[habit.id] ?? "";
          const has = value.trim().length > 0;

          return (
            <li
              key={habit.id}
              className="border-2 border-forest rounded-card bg-white shadow-hard p-4 sm:p-5 flex flex-col gap-2.5"
            >
              <div className="flex items-center gap-2 flex-wrap">
                {domain && (
                  <>
                    {Icon && <Icon className="w-4 h-4 text-clover" aria-hidden />}
                    <span
                      className="font-display font-bold text-sm tracking-wide"
                      style={{ fontVariantCaps: "small-caps" }}
                    >
                      {domain.name}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-clover" aria-hidden />
                  </>
                )}
                <span className="font-semibold">{habit.name}</span>
              </div>

              <label
                htmlFor={`briefing-${habit.id}`}
                className="text-sm text-forest/80"
              >
                {copy.briefingLabel}
              </label>
              <div className="relative">
                <textarea
                  id={`briefing-${habit.id}`}
                  rows={2}
                  placeholder={copy.briefingPlaceholder}
                  value={value}
                  onChange={(e) =>
                    setBriefings((prev) => ({ ...prev, [habit.id]: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 pr-11 border-2 border-forest rounded-lg bg-cream focus:bg-white min-h-[52px]"
                />
                {has && (
                  <span
                    className="absolute top-2.5 right-2.5 w-[22px] h-[22px] rounded-full bg-mint border-[1.5px] border-clover flex items-center justify-center"
                    aria-hidden
                  >
                    <Check className="w-3 h-3 text-clover" strokeWidth={3.4} />
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm opacity-75">
          {format(copy.briefingAnswered, { done: answered, total: habits.length })}
        </p>
        <SubmitButton label={copy.generate} savingLabel={copy.generating} />
      </div>
    </form>
  );
}

function SubmitButton({
  label,
  savingLabel,
}: {
  label: string;
  savingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${primaryButton} w-full sm:w-auto`}
    >
      {pending && (
        <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />
      )}
      {pending ? savingLabel : label}
    </button>
  );
}
