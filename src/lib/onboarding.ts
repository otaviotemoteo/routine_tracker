// Onboarding wizard flow. Steps live in the URL (?step=slug); each step saves
// on advance via a server action, so abandoning mid-way loses nothing.

export const ONBOARDING_STEPS = [
  "welcome",
  "workout",
  "reading",
  "sleep",
  "routine",
  "duolingo",
  "spirituality",
  "review",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const TOTAL_STEPS = ONBOARDING_STEPS.length;

export function resolveStep(value: string | undefined): OnboardingStep {
  return ONBOARDING_STEPS.includes(value as OnboardingStep)
    ? (value as OnboardingStep)
    : "welcome";
}

export function stepNumber(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step) + 1;
}

export function nextStep(step: OnboardingStep): OnboardingStep {
  const i = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[Math.min(i + 1, TOTAL_STEPS - 1)];
}

export function prevStep(step: OnboardingStep): OnboardingStep {
  const i = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[Math.max(i - 1, 0)];
}

export function stepHref(step: OnboardingStep): string {
  return `/onboarding?step=${step}`;
}

// Stable slug from a display name (used for languages and spiritual practices).
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
