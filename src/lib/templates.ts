// The template vocabulary — which is really three lists, and the gaps between
// them are a deliberate constraint rather than an oversight.
//
// A template is how a habit renders: its Today card, its grid cell, its
// check-in sheet, its summary sentence. `null`/'plain' is the generic one that
// works for any habit anywhere. The seven LEGACY kinds are the original
// hardcoded areas, kept exactly as they were. The five GENERIC kinds are the
// card-style chooser's vocabulary (`/habits/templates`) — new, but built to
// the same safety rule as `plain`: each reads only the habit's own columns
// (metricType, unit, target, minimalAction) and its own `config`/`details`,
// never a shared entity table, so any one of them may be given to any habit,
// old or new, without limit.
//
// WHY THE SEVEN LEGACY KINDS ARE NOT OFFERED TO NEW HABITS
//
// They are not merely un-extracted, they are *owner-shaped*. Each one reads a
// per-domain table — books, reading_goals, workout_plans, routine_blocks,
// spiritual_practices, languages — and every row in those tables belongs to
// the one account that filled them in through /onboarding, as a SINGLETON per
// account (one active workout plan, one sleep target). Their kinds are also
// that account's Portuguese slugs.
//
// So a habit with template_kind 'leitura' on a new account renders a reading
// card with no current book, no page target and no pace — a broken screen,
// not a degraded one. And a *second* habit of the same shape on the SAME
// account (a second "treino" habit) would just read the one existing plan
// again, silently duplicating it rather than getting its own — the invariant
// these seven depend on is "at most one habit per kind per account", which
// nothing enforces and a chooser would immediately violate. Until the
// renderers are extracted into a real registry that reads a habit's own
// `config` (the deferred §8 work), the only safe kinds for a habit beyond the
// owner's seven migrated rows are `plain` and the five generic kinds below.
//
// This is why HabitSuggester's templateKind was a one-member enum. Keeping
// the field rather than dropping it meant the model still named the kind in
// the same call that proposed the habit, and this file is that widening.

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

// The card-style chooser's five options. Each is a distinct, explicitly
// CONFIRMED choice — unlike `plain`, which also means "never touched the
// chooser" (see `today-card.ts`'s `plainCard`, which every one of `number`,
// `check` and `duration` still renders through; they exist as their own
// stored values so the chooser can tell "chosen" from "still just the
// default" and mark it solid rather than dashed).
export const GENERIC_TEMPLATE_KINDS = [
  "number", // Plain/number — a figure, its unit, its target.
  "check", // Done-or-not — a yes/no for today plus the streak.
  "duration", // Duration — minutes/hours plus the weekly total.
  "checklist", // Checklist — the habit's own named sub-items, ticked daily.
  "streak", // Streak-forward — the current streak takes the hero slot.
] as const;

export type GenericTemplateKind = (typeof GENERIC_TEMPLATE_KINDS)[number];

// What a template kind resolves to once null is normalised away.
export type TemplateKind =
  | LegacyTemplateKind
  | GenericTemplateKind
  | typeof PLAIN_KIND;

// What a generator is allowed to return, and what the habit form offers for a
// new habit. One entry, for the reasons at the top of this file — the chooser
// is a separate, deliberate step (`/habits/templates`), not something a model
// or the creation form picks on a habit's behalf.
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

export function isGenericTemplateKind(
  value: string | null
): value is GenericTemplateKind {
  return (
    value !== null &&
    GENERIC_TEMPLATE_KINDS.includes(value as GenericTemplateKind)
  );
}

// The single normalisation: a stored NULL or an unrecognised string means the
// generic renderer. Unrecognised is folded into plain on purpose — a row
// written by a future version of the app should render plainly on an older
// deploy rather than crash it.
export function templateKindOf(value: string | null): TemplateKind {
  if (isLegacyTemplateKind(value)) return value;
  if (isGenericTemplateKind(value)) return value;
  return PLAIN_KIND;
}

// A habit is eligible for the card-style chooser when it isn't one of the
// seven legacy kinds — that covers a never-touched habit (null) and one that
// already picked a generic kind (so re-opening the chooser and changing your
// mind is always possible).
export function isChoosableTemplateKind(value: string | null): boolean {
  return !isLegacyTemplateKind(value);
}

// The chooser's "suggested" badge, computed live rather than stored: a
// habit's metric type already implies which of the three simple kinds fits,
// so nothing needs remembering until the user actually confirms one — see
// UX_PRINCIPLES.md, "a suggestion looks like a suggestion until it is
// touched". Checklist and Streak-forward have no metric-driven default: both
// are equally sensible on any metric, so offering one as "suggested" would
// be a guess dressed up as a recommendation.
export function suggestedGenericTemplateKind(
  metricType: "binary" | "count" | "duration"
): GenericTemplateKind {
  if (metricType === "binary") return "check";
  if (metricType === "duration") return "duration";
  return "number";
}

// What goes INTO the database for a new habit. Plain habits store NULL rather
// than the string 'plain', so "has a template" stays a NULL check in SQL.
export function storedTemplateKind(
  kind: SuggestableTemplateKind
): string | null {
  return kind === PLAIN_KIND ? null : kind;
}

// Marks that Today's first-run card-templates nudge has been shown (or
// dismissed) once, so it stops appearing — a navigation hint, not a data
// flag, exactly like ONBOARDED_COOKIE in src/lib/onboarding.ts. Set only from
// a Server Action (src/app/(app)/templates-nudge-actions.ts); read from the
// Today page, which can only read cookies, not write them.
export const TEMPLATES_NUDGE_SEEN_COOKIE = "templates_nudge_seen";
