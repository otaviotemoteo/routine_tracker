"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { fieldBase, ghostButton, primaryButton } from "@/components/ui/styles";
import { DOMAIN_SLUGS, type DomainSlug } from "@/lib/domains";
import { ASSESSMENT_COPY } from "@/lib/i18n-assessment";
import type { Copy, Lang } from "@/lib/i18n";
import type { MetricType } from "@/db/schema";

export interface HabitFormValues {
  id?: number;
  name: string;
  domainSlug: DomainSlug | null;
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

// The habit form — used for both create and edit, empty or prefilled.
//
// Field set is deliberately short: name, area, metric (+ unit and target when
// the metric has a number), and the minimal action. `triggerWhen` and
// `triggerWhere` are in the method and worth having eventually, but they are
// the two most likely to make this feel like paperwork, so they are deferred.
//
// There is no template picker. Every habit created here is plain, because the
// seven rich renderers read tables only the owner has rows in — see
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
  const [name, setName] = useState(initial.name);
  const [metricType, setMetricType] = useState<MetricType>(initial.metricType);
  const [domainSlug, setDomainSlug] = useState(initial.domainSlug ?? "");
  const [unit, setUnit] = useState(initial.unit);
  const [target, setTarget] = useState(initial.target);
  const [minimalAction, setMinimalAction] = useState(initial.minimalAction);

  const domainNames = ASSESSMENT_COPY[lang].domains;

  // Dirtiness is measured, not guessed: a snapshot taken once on mount and
  // compared to the current state. Save stays disabled on an edit until
  // something actually changes, matching /config.
  const snapshot = useMemo(
    () => JSON.stringify(initial),
    // Intentionally frozen at mount — that is what makes it a baseline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const current = JSON.stringify({
    id: initial.id,
    name,
    domainSlug: (domainSlug || null) as DomainSlug | null,
    metricType,
    unit,
    target,
    minimalAction,
  });
  const dirty = current !== snapshot;

  // A binary habit counts nothing, so the unit and target fields don't apply.
  // Hidden rather than disabled: a control that can't do anything shouldn't
  // be on screen.
  const counts = metricType !== "binary";
  const canSave = name.trim().length > 0 && (initial.id === undefined || dirty);

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

      <div>
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
      </div>

      <div>
        <label htmlFor="habit-area" className={labelClass}>
          {copy.area}
        </label>
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
      </div>

      <fieldset>
        <legend className={labelClass}>{copy.metric}</legend>
        <div className="flex flex-col gap-2">
          {(
            [
              ["binary", copy.metricBinary, copy.metricBinaryHint],
              ["count", copy.metricCount, copy.metricCountHint],
              ["duration", copy.metricDuration, copy.metricDurationHint],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={`flex items-start gap-3 min-h-[44px] px-3 py-2 border-2 border-forest rounded-lg cursor-pointer ${
                metricType === value ? "bg-mint" : "bg-cream"
              }`}
            >
              <input
                type="radio"
                name="metricType"
                value={value}
                checked={metricType === value}
                onChange={() => setMetricType(value)}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="font-semibold block">{label}</span>
                <span className="text-sm opacity-75 block">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Revealed on relevance: these two only mean anything once the habit
          has a number to carry them. */}
      {counts && (
        <>
          <div>
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
              className={`${fieldBase} w-full max-w-[16rem]`}
            />
            <p className={hintClass}>{copy.unitHint}</p>
          </div>

          <div>
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
              className={`${fieldBase} font-mono max-w-[7rem]`}
            />
            <p className={hintClass}>{copy.targetHint}</p>
          </div>
        </>
      )}

      {/* Hidden inputs keep the submitted shape stable when the metric is
          binary, so the action always sees every field. */}
      {!counts && (
        <>
          <input type="hidden" name="unit" value="" />
          <input type="hidden" name="target" value="" />
        </>
      )}

      <div>
        <label htmlFor="habit-minimal" className={labelClass}>
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
        <p className={hintClass}>{copy.minimalActionHint}</p>
      </div>

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
