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

// The progress bar counts AREAS, not steps in this array: the intro carries no
// bar and `results` is the payoff rather than another thing to get through, so
// the bar runs 1..12 over the domains (see domainPosition in domains.ts).

export function assessmentStepHref(step: AssessmentStep): string {
  return `/assessment?step=${step}`;
}

export function isAssessmentStep(value: string): value is AssessmentStep {
  return ASSESSMENT_STEPS.includes(value as AssessmentStep);
}

// The first domain with no answer yet, or null when the grid is complete.
export function firstUnanswered(ratings: DomainRatings): DomainSlug | null {
  return DOMAIN_SLUGS.find((slug) => !ratings[slug]) ?? null;
}

// The directions-writing equivalent: the first priority domain with nothing
// written yet, or null once every one has a direction. Mirrors
// firstUnanswered() exactly, and drives the same kind of ceiling — walking
// the five priority domains in order, no skipping ahead via the URL.
export function firstUndirected(
  priority: DomainSlug[],
  written: Record<string, { narrative?: string }>
): DomainSlug | null {
  return priority.find((slug) => !written[slug]?.narrative?.trim()) ?? null;
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

// The areas this cycle is actually being built on: the frozen priority cut,
// plus any area the person added on the review screen by writing a direction
// for it.
//
// Derived rather than stored, and that is the point. `priority_domains` was
// written once when the assessment was sealed and is the record of what the
// engine said from the answers given — rewriting it to include a sixth area
// would be exactly the history-editing the seal exists to prevent. So an added
// area is simply an area with a direction, and this function is the one place
// that definition lives. The areas screen and the habit generator both read
// it, which is what keeps them from disagreeing about what the cycle is about.
export function buildingAreas(
  priority: DomainSlug[],
  written: Record<string, { narrative: string }>
): DomainSlug[] {
  const added = DOMAIN_SLUGS.filter(
    (slug) => !priority.includes(slug) && written[slug]?.narrative?.trim()
  );
  // Priority first, in the engine's order; additions after, in domain order.
  return [...priority, ...added];
}
