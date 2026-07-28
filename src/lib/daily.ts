// The guided "Complete daily" flow: one habit per step, in habit-id order,
// mirroring the onboarding wizard's mechanics (src/lib/onboarding.ts).

export const DAILY_STEPS = [
  "treino",
  "leitura",
  "sono",
  "rotina",
  "duolingo",
  "espiritualidade",
  "hobby",
] as const;

export type DailyStepSlug = (typeof DAILY_STEPS)[number];

export const TOTAL_DAILY_STEPS = DAILY_STEPS.length;

export function resolveDailyStep(value: string | undefined): DailyStepSlug {
  return DAILY_STEPS.includes(value as DailyStepSlug)
    ? (value as DailyStepSlug)
    : DAILY_STEPS[0];
}

export function dailyStepNumber(slug: DailyStepSlug): number {
  return DAILY_STEPS.indexOf(slug) + 1;
}

export function dailyStepHref(slug: DailyStepSlug): string {
  return `/day?step=${slug}`;
}

// After the last step the flow is over — back to Today.
export function nextDailyHref(slug: DailyStepSlug): string {
  const i = DAILY_STEPS.indexOf(slug);
  return i >= DAILY_STEPS.length - 1 ? "/" : dailyStepHref(DAILY_STEPS[i + 1]);
}

export function prevDailyHref(slug: DailyStepSlug): string | undefined {
  const i = DAILY_STEPS.indexOf(slug);
  return i <= 0 ? undefined : dailyStepHref(DAILY_STEPS[i - 1]);
}
