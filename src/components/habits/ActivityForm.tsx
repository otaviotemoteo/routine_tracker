"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { fieldBase, ghostButton, primaryButton } from "@/components/ui/styles";
import { format, type Copy } from "@/lib/i18n";
import type { MetricType } from "@/db/schema";

export interface ActivityFormValues {
  id: number;
  name: string;
  metricType: MetricType;
  unit: string;
  target: string;
  minimalAction: string;
}

interface ActivityFormProps {
  action: (formData: FormData) => void;
  initial: ActivityFormValues;
  copy: Copy["habits"];
  next: string;
  cancelHref: string;
}

const labelClass = "block mb-1.5 font-semibold text-sm";
const hintClass = "mt-1 text-sm opacity-75";

function Section({
  step,
  aside,
  children,
}: {
  step: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-2 border-forest rounded-card bg-white shadow-hard p-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h2 className="font-mono text-[10px] font-bold tracking-wider opacity-60">
          {step}
        </h2>
        {aside && <p className="text-xs font-semibold opacity-60">{aside}</p>}
      </div>
      {children}
    </section>
  );
}

// A plain ACTIVITY's own editor — its name (the card's own label, distinct
// from its habit's umbrella name the moment a habit has more than one
// activity), its metric spine, and its minimal action. The sibling of
// HabitForm's Sections 2–3, moved here wholesale once the habit stopped
// carrying either — see docs/ARCHITECTURE.md.
//
// Reached from /config?activity=<id> for any activity with no rich
// template_kind. A rich-kind activity (treino/leitura/...) is edited by its
// own step component instead — this form has nothing to say about a
// workout plan or a reading list.
export function ActivityForm({
  action,
  initial,
  copy,
  next,
  cancelHref,
}: ActivityFormProps) {
  const [name, setName] = useState(initial.name);
  const [metricType, setMetricType] = useState<MetricType>(initial.metricType);
  const [unit, setUnit] = useState(initial.unit);
  const [target, setTarget] = useState(initial.target);
  const [minimalAction, setMinimalAction] = useState(initial.minimalAction);

  const snapshot = useMemo(
    () => JSON.stringify(initial),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const current = JSON.stringify({
    id: initial.id,
    name,
    metricType,
    unit,
    target,
    minimalAction,
  });
  const dirty = current !== snapshot;

  const counts = metricType !== "binary";
  const canSave = name.trim().length > 0 && dirty;

  return (
    <form action={action} className="mt-6 flex flex-col gap-5">
      <input type="hidden" name="id" value={initial.id} />
      <input type="hidden" name="next" value={next} />

      <Section step={copy.step1}>
        <label htmlFor="activity-name" className={labelClass}>
          {copy.name}
        </label>
        <input
          id="activity-name"
          name="name"
          required
          maxLength={50}
          autoFocus
          placeholder={copy.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${fieldBase} w-full`}
        />
      </Section>

      <Section step={copy.step2} aside={copy.step2Hint}>
        <fieldset>
          <legend className="sr-only">{copy.metric}</legend>
          <div className="flex flex-col gap-2">
            {(
              [
                ["binary", copy.metricBinary, copy.metricBinaryHint, copy.unitDone],
                ["count", copy.metricCount, copy.metricCountHint, copy.unitCount],
                [
                  "duration",
                  copy.metricDuration,
                  copy.metricDurationHint,
                  copy.unitTime,
                ],
              ] as const
            ).map(([value, label, hint, badge]) => {
              const on = metricType === value;
              return (
                <label
                  key={value}
                  className={`flex items-center gap-3 min-h-[44px] px-3 py-2.5 border-2 rounded-lg cursor-pointer ${
                    on ? "bg-mint border-clover" : "bg-cream border-sand"
                  }`}
                >
                  <input
                    type="radio"
                    name="metricType"
                    value={value}
                    checked={on}
                    onChange={() => setMetricType(value)}
                    className="sr-only peer"
                  />
                  <span
                    aria-hidden
                    className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-clover peer-focus-visible:ring-offset-2 ${
                      on ? "border-clover bg-clover" : "border-sand bg-white"
                    }`}
                  >
                    {on && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold block">{label}</span>
                    <span className="text-sm opacity-75 block">{hint}</span>
                  </span>
                  <span
                    className={`shrink-0 font-mono text-[10px] font-bold tracking-wider px-2 py-1 rounded-full ${
                      on ? "bg-clover/20 text-forest" : "bg-sand/50 opacity-60"
                    }`}
                  >
                    {badge}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {counts && (
          <div className="flex gap-3 flex-wrap mt-4">
            <div className="min-w-0 flex-1">
              <label htmlFor="activity-unit" className={labelClass}>
                {copy.unit}
              </label>
              <input
                id="activity-unit"
                name="unit"
                maxLength={20}
                placeholder={copy.unitPlaceholder}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={`${fieldBase} w-full`}
              />
              <p className={hintClass}>{copy.unitHint}</p>
            </div>
            <div className="shrink-0">
              <label htmlFor="activity-target" className={labelClass}>
                {copy.target}
              </label>
              <input
                id="activity-target"
                name="target"
                type="number"
                min={1}
                inputMode="numeric"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className={`${fieldBase} font-mono w-[7rem]`}
              />
              <p className={hintClass}>{copy.targetHint}</p>
            </div>
          </div>
        )}

        {!counts && (
          <>
            <input type="hidden" name="unit" value="" />
            <input type="hidden" name="target" value="" />
          </>
        )}
      </Section>

      <Section step={copy.step3}>
        <p className="text-sm opacity-75 mb-3">{copy.minimalLead}</p>
        <label htmlFor="activity-minimal" className="sr-only">
          {copy.minimalAction}
        </label>
        <input
          id="activity-minimal"
          name="minimalAction"
          maxLength={200}
          placeholder={copy.minimalActionPlaceholder}
          value={minimalAction}
          onChange={(e) => setMinimalAction(e.target.value)}
          className={`${fieldBase} w-full`}
        />
        <div className="mt-3 bg-straw/25 rounded-lg px-3 py-2.5">
          <p className="font-mono text-[9px] font-bold tracking-wider opacity-60">
            {copy.previewLabel}
          </p>
          <p aria-live="polite" className="mt-1 text-sm font-semibold">
            {minimalAction.trim()
              ? format(copy.previewFilled, { action: minimalAction.trim() })
              : copy.previewEmpty}
          </p>
        </div>
      </Section>

      <div className="flex gap-2 flex-wrap justify-end pt-1">
        <Link href={cancelHref} className={ghostButton}>
          {copy.cancel}
        </Link>
        <SaveButton copy={copy} disabled={!canSave} />
      </div>
    </form>
  );
}

function SaveButton({
  copy,
  disabled,
}: {
  copy: Copy["habits"];
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={primaryButton}>
      {pending ? copy.saving : copy.save}
    </button>
  );
}
