// The values check-in flow: an intro, one screen per life domain, then the
// results. Third instance of the wizard mechanic (src/lib/onboarding.ts and
// src/lib/daily.ts are the other two), deliberately identical so the app only
// ever teaches one interaction.
//
// The one thing this flow has that the others don't is a ceiling. You can walk
// back through what you have answered, but you cannot skip ahead, and you
// cannot reach the results before the grid is finished. That lives here as
// arithmetic rather than as a hidden button, because a UI convention is one
// URL edit away from being ignored.

import { DOMAIN_SLUGS, isDomainSlug, type DomainSlug } from "./domains";
import type { DomainRatings } from "./diagnose";

export const ASSESSMENT_STEPS = [
  "intro",
  ...DOMAIN_SLUGS,
  "results",
] as const;

export type AssessmentStep = (typeof ASSESSMENT_STEPS)[number];

// The intro plus the twelve domains. `results` sits outside the count: it is
// the payoff, not another thing to get through, so the bar reads 100% when the
// last domain is answered rather than 92%.
export const TOTAL_ASSESSMENT_STEPS = ASSESSMENT_STEPS.length - 1;

export function assessmentStepHref(step: AssessmentStep): string {
  return `/assessment?step=${step}`;
}

export function assessmentStepNumber(step: AssessmentStep): number {
  return ASSESSMENT_STEPS.indexOf(step) + 1;
}

export function isAssessmentStep(value: string): value is AssessmentStep {
  return ASSESSMENT_STEPS.includes(value as AssessmentStep);
}

// The first domain with no answer yet, or null when the grid is complete.
export function firstUnanswered(ratings: DomainRatings): DomainSlug | null {
  return DOMAIN_SLUGS.find((slug) => !ratings[slug]) ?? null;
}

export function answeredCount(ratings: DomainRatings): number {
  return DOMAIN_SLUGS.filter((slug) => ratings[slug]).length;
}

// Where the request is actually allowed to land.
//
// Backwards is free: revising an answer while the grid is still open is fine,
// and the check-in is easier to finish if you can second-guess area three from
// area seven. Forwards is not, and neither is the results screen before the
// last domain is in. Seeing a result you have not finished producing is how
// people start answering toward the result.
export function resolveAssessmentStep(
  raw: string | undefined,
  ratings: DomainRatings
): AssessmentStep {
  const next = firstUnanswered(ratings);
  const requested: AssessmentStep =
    raw && isAssessmentStep(raw) ? raw : "intro";

  // Grid finished: everything is readable, including the results.
  if (!next) return requested;

  if (requested === "results") return next;
  if (requested === "intro") return "intro";
  if (!isDomainSlug(requested)) return "intro";

  const ceiling = ASSESSMENT_STEPS.indexOf(next);
  const asked = ASSESSMENT_STEPS.indexOf(requested);
  return asked <= ceiling ? requested : next;
}

// After a domain is saved, go to the next one, or to the results if that was
// the last. The href is resolved again on arrival, so a stale link can't jump
// the ceiling.
export function nextAssessmentHref(step: AssessmentStep): string {
  const i = ASSESSMENT_STEPS.indexOf(step);
  const next = ASSESSMENT_STEPS[Math.min(i + 1, ASSESSMENT_STEPS.length - 1)];
  return assessmentStepHref(next);
}

export function prevAssessmentHref(step: AssessmentStep): string | undefined {
  const i = ASSESSMENT_STEPS.indexOf(step);
  return i <= 0 ? undefined : assessmentStepHref(ASSESSMENT_STEPS[i - 1]);
}
