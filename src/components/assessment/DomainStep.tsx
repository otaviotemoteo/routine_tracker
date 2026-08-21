"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { primaryButton, ghostButton } from "@/components/ui/styles";
import { RatingScale } from "./RatingScale";
import { DomainStepSkeleton } from "./DomainStepSkeleton";
import { RATING_SCALES, type DomainSlug, type ScaleKey } from "@/lib/domains";
import { format, plural, type Copy } from "@/lib/i18n";

type Answers = Partial<Record<ScaleKey, number>>;

interface DomainStepProps {
  action: (formData: FormData) => Promise<void>;
  next: string;
  backHref?: string;
  slug: DomainSlug;
  isLast: boolean;
  copy: Copy["assessment"];
  // Whatever was already answered for this domain, so walking back shows what
  // you said. Never seeded from an earlier check-in.
  initial: Answers;
}

// One life domain: what the area covers, what it does not, and the six
// questions.
//
// There is no Skip here, which breaks the wizard's usual rule on purpose. A
// half-answered grid is not a weaker grid, it is one that cannot be compared
// to the next cycle, and comparison is the only reason any of this is stored.
// The whole check-in is still abandonable at any moment: the draft keeps
// whatever is in it.
//
// Submission is driven by useTransition, not the plain <form action> +
// useFormStatus pattern the rest of onboarding uses: `action` calls
// redirect() into the NEXT domain, and useFormStatus's `pending` turned out
// to go false the moment the action itself returns — before the next page's
// own data has actually loaded, which is exactly the gap that showed up as a
// blank flash between the skeleton and the real content. Wrapping the call
// in startTransition keeps `isPending` true across the whole thing,
// redirect included, because that's what the transition is FOR.
export function DomainStep({
  action,
  next,
  backHref,
  slug,
  isLast,
  copy,
  initial,
}: DomainStepProps) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [isPending, startTransition] = useTransition();
  const domain = copy.domains[slug];
  const missing = RATING_SCALES.filter((key) => answers[key] === undefined).length;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await action(formData);
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="domain" value={slug} />

      {isPending ? (
        <DomainStepSkeleton />
      ) : (
        <>
          {/* No eyebrow here: OnboardingProgress above already renders the
              "Area n of 12" line in the eyebrow style, and two counters
              stacked with different denominators is worse than one. */}
          <h1 className="display-title text-3xl sm:text-4xl">{domain.name}</h1>
          <p className="mt-2 opacity-75">{domain.description}</p>

          {/* The worksheet is emphatic that the areas must not bleed into
              each other, and family against partner against children is
              exactly where it happens. Saying it here costs one line and
              saves the answer. */}
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
                  unansweredHint={copy.scaleUnanswered}
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
              {/* Says what is still missing rather than leaving a dead
                  button to be puzzled over. */}
              {missing > 0 && (
                <p aria-live="polite" className="text-sm opacity-75">
                  {format(
                    plural(missing, copy.domainStep.remainingOne, copy.domainStep.remaining),
                    { n: missing }
                  )}
                </p>
              )}
              <button
                type="submit"
                disabled={missing > 0 || isPending}
                className={primaryButton}
              >
                {isPending && (
                  <Loader2
                    className="w-4 h-4 animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                )}
                {isPending ? copy.saving : isLast ? copy.domainStep.finish : copy.continueLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </form>
  );
}
