"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { primaryButton, ghostButton } from "@/components/onboarding/OnboardingChrome";
import { RatingScale } from "./RatingScale";
import { RATING_SCALES, type DomainSlug, type ScaleKey } from "@/lib/domains";
import { format, plural, type Copy } from "@/lib/i18n";

type Answers = Partial<Record<ScaleKey, number>>;

interface DomainStepProps {
  action: (formData: FormData) => Promise<void>;
  next: string;
  backHref?: string;
  slug: DomainSlug;
  stepNumber: number;
  totalDomains: number;
  isLast: boolean;
  copy: Copy["assessment"];
  // Whatever was already answered for this domain, so walking back shows what
  // you said. Never seeded from an earlier check-in.
  initial: Answers;
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
    <button type="submit" disabled={disabled || pending} className={primaryButton}>
      {pending && (
        <Loader2
          className="w-4 h-4 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
      )}
      {pending ? savingLabel : label}
    </button>
  );
}

// One life domain: what the area covers, what it does not, and the six
// questions.
//
// There is no Skip here, which breaks the wizard's usual rule on purpose. A
// half-answered grid is not a weaker grid, it is one that cannot be compared
// to the next cycle, and comparison is the only reason any of this is stored.
// The whole check-in is still abandonable at any moment: the draft keeps
// whatever is in it.
export function DomainStep({
  action,
  next,
  backHref,
  slug,
  stepNumber,
  totalDomains,
  isLast,
  copy,
  initial,
}: DomainStepProps) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const domain = copy.domains[slug];
  const missing = RATING_SCALES.filter((key) => answers[key] === undefined).length;

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="domain" value={slug} />

      <p className="eyebrow mb-2">
        {format(copy.domainStep.eyebrow, {
          current: stepNumber,
          total: totalDomains,
        })}
      </p>
      <h1 className="display-title text-3xl sm:text-4xl">{domain.name}</h1>
      <p className="mt-2 opacity-75">{domain.description}</p>

      {/* The worksheet is emphatic that the areas must not bleed into each
          other, and family against partner against children is exactly where
          it happens. Saying it here costs one line and saves the answer. */}
      <p className="mt-3 text-sm bg-straw/15 border-2 border-forest rounded-card px-4 py-2.5">
        <span className="font-semibold">{copy.domainStep.boundaryLabel}: </span>
        {domain.boundary}
      </p>

      <div className="flex flex-col gap-3 mt-6">
        {RATING_SCALES.map((key) => {
          const scale = copy.scales[key];
          return (
            <RatingScale
              key={key}
              name={key}
              label={scale.label}
              question={scale.question}
              why={scale.why}
              lowAnchor={scale.lowAnchor}
              highAnchor={scale.highAnchor}
              whyLabel={copy.domainStep.whyLabel}
              unansweredLabel={copy.domainStep.unanswered}
              valueTemplate={copy.scaleValue}
              rangeTemplate={copy.scaleRange}
              value={answers[key] ?? null}
              onChange={(value) =>
                setAnswers((prev) => ({ ...prev, [key]: value }))
              }
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mt-6">
        <div>
          {backHref && (
            <Link href={backHref} className={ghostButton}>
              {copy.back}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Says what is still missing rather than leaving a dead button to
              be puzzled over. */}
          {missing > 0 && (
            <p aria-live="polite" className="text-sm opacity-75">
              {format(
                plural(missing, copy.domainStep.remainingOne, copy.domainStep.remaining),
                { n: missing }
              )}
            </p>
          )}
          <SubmitButton
            label={isLast ? copy.domainStep.finish : copy.continueLabel}
            savingLabel={copy.saving}
            disabled={missing > 0}
          />
        </div>
      </div>
    </form>
  );
}
