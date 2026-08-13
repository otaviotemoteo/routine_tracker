// The template vocabulary — which is really two lists, and the gap between
// them is a deliberate constraint rather than an oversight.
//
// A template is how a habit renders: its Today card, its grid cell, its
// check-in sheet, its summary sentence. `null`/'plain' is the generic one that
// works for any habit anywhere. The other seven are the original hardcoded
// areas, kept exactly as they were.
//
// WHY THE SEVEN ARE NOT OFFERED TO NEW HABITS
//
// They are not merely un-extracted, they are *owner-shaped*. Each one reads a
// per-domain table — books, reading_goals, workout_plans, routine_blocks,
// spiritual_practices, languages — and every row in those tables belongs to
// the one account that filled them in through /onboarding. Their kinds are
// also the owner's Portuguese slugs.
//
// So a habit with template_kind 'leitura' on a new account renders a reading
// card with no current book, no page target and no pace: a broken screen, not
// a degraded one. Until the renderers are extracted into a real registry that
// reads a habit's own `config` (the deferred §8 work), the only safe kind for
// a NEW habit is the plain one.
//
// This is why HabitSuggester's templateKind is a one-member enum. Keeping the
// field rather than dropping it means the model still names the kind in the
// same call that proposes the habit, and widening the list later is an edit to
// SUGGESTABLE_TEMPLATE_KINDS alone.

// The generic renderer. Stored as NULL in the database — a habit with no
// template is the normal case, not a special one — and named here so code can
// talk about it without spelling `null` at twenty call sites.
export const PLAIN_KIND = "plain" as const;

// The seven original areas. Only ever present on the owner's migrated rows;
// nothing in the app writes one of these to a new habit.
export const LEGACY_TEMPLATE_KINDS = [
  "treino",
  "leitura",
  "sono",
  "rotina",
  "duolingo",
  "espiritualidade",
  "hobby",
] as const;

export type LegacyTemplateKind = (typeof LEGACY_TEMPLATE_KINDS)[number];

// What a template kind resolves to once null is normalised away.
export type TemplateKind = LegacyTemplateKind | typeof PLAIN_KIND;

// What a generator is allowed to return, and what the habit form offers for a
// new habit. One entry, for the reasons at the top of this file.
export const SUGGESTABLE_TEMPLATE_KINDS = [PLAIN_KIND] as const;

export type SuggestableTemplateKind =
  (typeof SUGGESTABLE_TEMPLATE_KINDS)[number];

export function isLegacyTemplateKind(
  value: string | null
): value is LegacyTemplateKind {
  return (
    value !== null &&
    LEGACY_TEMPLATE_KINDS.includes(value as LegacyTemplateKind)
  );
}

// The single normalisation: a stored NULL, an unknown string, or an explicit
// 'plain' all mean the generic renderer. Unknown is folded into plain on
// purpose — a row written by a future version of the app should render
// plainly on an older deploy rather than crash it.
export function templateKindOf(value: string | null): TemplateKind {
  return isLegacyTemplateKind(value) ? value : PLAIN_KIND;
}

// What goes INTO the database for a new habit. Plain habits store NULL rather
// than the string 'plain', so "has a template" stays a NULL check in SQL.
export function storedTemplateKind(
  kind: SuggestableTemplateKind
): string | null {
  return kind === PLAIN_KIND ? null : kind;
}
