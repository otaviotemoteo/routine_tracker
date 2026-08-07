// The twelve life domains and the six scales each is rated on — the ordered
// vocabulary the whole values layer is built from. Names, descriptions and
// prompts are NOT here: they live in src/lib/i18n-assessment.ts, because the
// app is bilingual and `habits.name` already shows what it costs to bake one
// language into the data (it needs habitName() to undo it).
//
// The order is fixed and never randomised. Shuffling would reduce order-effect
// but destroy comparability between cycles, and the longitudinal record is the
// only reason this feature exists.

export const DOMAIN_SLUGS = [
  "family",
  "couple",
  "parenting",
  "friends",
  "work",
  "education",
  "recreation",
  "spirituality",
  "community",
  "health",
  "environment",
  "art",
] as const;

export type DomainSlug = (typeof DOMAIN_SLUGS)[number];

export const TOTAL_DOMAINS = DOMAIN_SLUGS.length;

// The six columns of the grid, in the order they're asked. Possibility comes
// first because it's the least loaded question, and the two importance scales
// sit together so the "right now" / "in general" distinction is visible.
export const RATING_SCALES = [
  "possibility",
  "importanceNow",
  "importanceGeneral",
  "action",
  "actionSatisfaction",
  "concern",
] as const;

export type ScaleKey = (typeof RATING_SCALES)[number];

// Every scale runs 1–10. Stored as-is, never normalised on write: raw values
// are what makes one cycle comparable to the next.
export const SCALE_MIN = 1;
export const SCALE_MAX = 10;

export function isDomainSlug(value: string): value is DomainSlug {
  return DOMAIN_SLUGS.includes(value as DomainSlug);
}

// 1-based, matching life_domains.position in the database.
export function domainPosition(slug: DomainSlug): number {
  return DOMAIN_SLUGS.indexOf(slug) + 1;
}
