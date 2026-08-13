// The guided "Complete daily" flow: one habit per step, mirroring the
// onboarding wizard's mechanics (src/lib/onboarding.ts).
//
// The steps used to be a hardcoded array of seven slugs, which was the same
// modelling error as the shared habits table: it baked one person's routine
// into the code. They are now derived from whatever habits the user actually
// tracks, so a friend with four habits walks four steps.
//
// Every function takes the ordered slug list, which the caller already holds —
// /day loads the day's checks before it can render anything, and those come
// back in habit order (position, then id).

export type DailyStepSlug = string;

export function resolveDailyStep(
  value: string | undefined,
  slugs: readonly string[]
): DailyStepSlug | null {
  if (slugs.length === 0) return null;
  return value && slugs.includes(value) ? value : slugs[0];
}

// 1-based, for the progress bar. Zero when the slug isn't in the flow, which
// the caller should have already turned into a 404.
export function dailyStepNumber(
  slug: DailyStepSlug,
  slugs: readonly string[]
): number {
  return slugs.indexOf(slug) + 1;
}

export function dailyStepHref(slug: DailyStepSlug): string {
  return `/day?step=${encodeURIComponent(slug)}`;
}

// After the last step the flow is over — back to Today.
export function nextDailyHref(
  slug: DailyStepSlug,
  slugs: readonly string[]
): string {
  const i = slugs.indexOf(slug);
  return i < 0 || i >= slugs.length - 1 ? "/" : dailyStepHref(slugs[i + 1]);
}

export function prevDailyHref(
  slug: DailyStepSlug,
  slugs: readonly string[]
): string | undefined {
  const i = slugs.indexOf(slug);
  return i <= 0 ? undefined : dailyStepHref(slugs[i - 1]);
}
