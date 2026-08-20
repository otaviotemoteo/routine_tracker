"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { fieldBase, ghostButton, primaryButton } from "@/components/ui/styles";
import { DOMAIN_SLUGS, type DomainSlug } from "@/lib/domains";
import { ASSESSMENT_COPY } from "@/lib/i18n-assessment";
import { format, type Copy, type Lang } from "@/lib/i18n";
import type { MetricType } from "@/db/schema";

export interface HabitFormValues {
  id?: number;
  name: string;
  domainSlug: DomainSlug | null;
  // Only meaningful when creating: a new habit's default activity is
  // created in the same submission (see docs/HABIT-VS-ACTIVITY-MODEL.md).
  // Editing an existing habit shows name/area only — its metric spine
  // belongs to its activity now, edited from /config.
  metricType: MetricType;
  unit: string;
  target: string;
  minimalAction: string;
}

interface HabitFormProps {
  action: (formData: FormData) => void;
  initial: HabitFormValues;
  lang: Lang;
  copy: Copy["habits"];
  next: string;
  cancelHref: string;
  // On the review screen a new habit joins the proposed set instead of being
  // tracked immediately.
  proposed?: boolean;
  showError?: boolean;
}

const labelClass = "block mb-1.5 font-semibold text-sm";
const hintClass = "mt-1 text-sm opacity-75";

// One numbered step of the form, on its own surface.
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

// The habit form — used for both create and edit, empty or prefilled.
//
// CREATING shows all three sections: name/area, metric (+ unit and target
// when the metric has a number), and the minimal action — one submission
// creates the habit AND its one default activity together (the
// default-activity invariant, docs/HABIT-VS-ACTIVITY-MODEL.md).
//
// EDITING shows only the first section. The metric spine and minimal action
// belong to the habit's activity now, not the umbrella — editing those
// happens from /config, which the form links out to. This is the same rule
// `HabitEdit`'s `?: never` guards enforce one layer down: the form only ever
// owns the fields it shows.
//
// There is no template picker. Every activity created here is plain, because
// the seven rich renderers read config only their own activity has — see
// src/lib/templates.ts. A picker offering choices that break is worse than no
// picker at all.
export function HabitForm({
  action,
  initial,
  lang,
  copy,
  next,
  cancelHref,
  proposed = false,
  showError = false,
}: HabitFormProps) {
  const isCreating = initial.id === undefined;
  const [name, setName] = useState(initial.name);
  const [metricType, setMetricType] = useState<MetricType>(initial.metricType);
  const [domainSlug, setDomainSlug] = useState(initial.domainSlug ?? "");
  const [unit, setUnit] = useState(initial.unit);
  const [target, setTarget] = useState(initial.target);
  const [minimalAction, setMinimalAction] = useState(initial.minimalAction);

  const domainNames = ASSESSMENT_COPY[lang].domains;

  // Dirtiness is measured, not guessed: a snapshot taken once on mount and
  // compared to the current state. Save stays disabled on an edit until
  // something actually changes, matching /config. Editing only ever touches
  // name/area now, so only those two are part of the comparison — the
  // metric fields aren't rendered on that path at all.
  const snapshot = useMemo(
    () =>
      JSON.stringify(
        isCreating
          ? initial
          : { id: initial.id, name: initial.name, domainSlug: initial.domainSlug }
      ),
    // Intentionally frozen at mount — that is what makes it a baseline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const current = JSON.stringify(
    isCreating
      ? {
          id: initial.id,
          name,
          domainSlug: (domainSlug || null) as DomainSlug | null,
          metricType,
          unit,
          target,
          minimalAction,
        }
      : { id: initial.id, name, domainSlug: (domainSlug || null) as DomainSlug | null }
  );
  const dirty = current !== snapshot;

  // A binary habit counts nothing, so the unit and target fields don't apply.
  // Hidden rather than disabled: a control that can't do anything shouldn't
  // be on screen.
  const counts = metricType !== "binary";
  const canSave = name.trim().length > 0 && (isCreating || dirty);

  return (
    <form action={action} className="mt-6 flex flex-col gap-5">
      {initial.id !== undefined && (
        <input type="hidden" name="id" value={initial.id} />
      )}
      <input type="hidden" name="next" value={next} />
      {proposed && <input type="hidden" name="proposed" value="1" />}

      {showError && (
        <p
          role="alert"
          className="border-2 border-forest bg-straw rounded-lg px-3 py-2 text-sm font-semibold"
        >
          {copy.nameRequired}
        </p>
      )}

      {/* Three numbered steps rather than one flat column of fields.
          The habit form asks for three different KINDS of thing — what it is,
          how it is counted, and what the bad-day version is — and numbering
          them turns "a form" into "three small questions", which is the
          difference between filling it in and abandoning it. */}
      <Section step={copy.step1}>
        <label htmlFor="habit-name" className={labelClass}>
          {copy.name}
        </label>
        <input
          id="habit-name"
          name="name"
          required
          maxLength={50}
          autoFocus
          placeholder={copy.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${fieldBase} w-full`}
        />

        <div className="flex items-baseline justify-between gap-3 mt-4 mb-1.5">
          <label htmlFor="habit-area" className="font-semibold text-sm">
            {copy.area}
          </label>
          {domainSlug === "" && (
            <span className="text-xs font-semibold opacity-60">
              {copy.areaNone}
            </span>
          )}
        </div>
        <select
          id="habit-area"
          name="domainSlug"
          value={domainSlug}
          onChange={(e) => setDomainSlug(e.target.value)}
          className={`${fieldBase} w-full`}
        >
          <option value="">{copy.areaNone}</option>
          {DOMAIN_SLUGS.map((slug) => (
            <option key={slug} value={slug}>
              {domainNames[slug].name}
            </option>
          ))}
        </select>
        <p className={hintClass}>{copy.areaHint}</p>
      </Section>

      {!isCreating && (
        <p className="text-sm opacity-75">
          {copy.editMeasurementLead}{" "}
          <Link href="/config" className="font-semibold underline">
            {copy.editMeasurementLink}
          </Link>
        </p>
      )}

      {isCreating && (
      <>
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
                  {/* The native radio stays — it is what makes this a real
                      radio group for the keyboard and for a screen reader —
                      and the circle beside it is the visible one. */}
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

        {/* Revealed on relevance: these two only mean anything once the habit
            has a number to carry them. */}
        {counts && (
          <div className="flex gap-3 flex-wrap mt-4">
            <div className="min-w-0 flex-1">
              <label htmlFor="habit-unit" className={labelClass}>
                {copy.unit}
              </label>
              <input
                id="habit-unit"
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
              <label htmlFor="habit-target" className={labelClass}>
                {copy.target}
              </label>
              <input
                id="habit-target"
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

        {/* Hidden inputs keep the submitted shape stable when the metric is
            binary, so the action always sees every field. */}
        {!counts && (
          <>
            <input type="hidden" name="unit" value="" />
            <input type="hidden" name="target" value="" />
          </>
        )}
      </Section>

      <Section step={copy.step3}>
        <p className="text-sm opacity-75 mb-3">{copy.minimalLead}</p>
        <label htmlFor="habit-minimal" className="sr-only">
          {copy.minimalAction}
        </label>
        <input
          id="habit-minimal"
          name="minimalAction"
          maxLength={200}
          placeholder={copy.minimalActionPlaceholder}
          value={minimalAction}
          onChange={(e) => setMinimalAction(e.target.value)}
          className={`${fieldBase} w-full`}
        />

        {/* The field's consequence, shown as you type. This is the one input
            whose value reappears verbatim on another screen, months later, on
            the worst day — so seeing the sentence it will become is worth more
            than a hint explaining it. */}
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
      </>
      )}

      <div className="flex gap-2 flex-wrap justify-end pt-1">
        <Link href={cancelHref} className={ghostButton}>
          {copy.cancel}
        </Link>
        <SaveButton copy={copy} disabled={!canSave} />
      </div>
    </form>
  );
}

// Every async action reports itself.
function SaveButton({
  copy,
  disabled,
}: {
  copy: Copy["habits"];
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={primaryButton}
    >
      {pending ? copy.saving : copy.save}
    </button>
  );
}
