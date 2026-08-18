// The template vocabulary — how a habit renders: its Today card, its grid
// cell, its check-in sheet, its summary sentence. `null`/'plain' is the
// generic one that works for any habit anywhere with no setup at all.
//
// Every other kind reads only the habit's own columns (metricType, unit,
// target, minimalAction) and its own `config`/`details` — never a shared,
// account-wide table — so any one of them may be given to any habit, old or
// new, without limit. That used to only be true of five kinds; the other
// seven (treino/leitura/sono/rotina/duolingo/espiritualidade/hobby) each read
// a per-domain table (workout_plans, books, routine_blocks,
// spiritual_practices, languages, sleep_targets) that assumed exactly one
// account owned exactly one row/list, account-wide — a real habit couldn't
// safely be given one of those seven kinds without either breaking (no data
// to render) or silently sharing another habit's plan.
//
// Phase 3 closed that gap at the data layer: the six with real setup (all
// but `hobby`, which never had a table) now keep that setup in the habit's
// own `config`, shaped by config-schemas.ts — the same place Checklist's
// `{items}` has always lived. Reading a per-domain table is no longer
// possible, and every render/status/summary function below dispatches on
// `config` alone — nothing left in this file is unsafe to run on any habit.
//
// What DIDN'T change: the `/habits/templates` chooser's own UI still only
// knows the original five cards — no copy, icon, or setup flow exists yet
// for "pick Workout from the chooser", and the owner's real seven habits
// still don't appear in that list, exactly as before. `RICH_TEMPLATE_KINDS`
// exists so the rest of the app can treat those six as first-class, safe
// kinds; whether the chooser itself ever offers them is a separate, later
// decision — see the Phase 3 plan's "explicitly deferred" section.

// The generic renderer. Stored as NULL in the database — a habit with no
// template is the normal case, not a special one — and named here so code can
// talk about it without spelling `null` at twenty call sites.
export const PLAIN_KIND = "plain" as const;

// The card-style-chooser's kinds — the exact five it has always offered.
// `TemplateChooserList` renders one card per member of this list, so adding
// to it is a UI decision (copy, icon, preview), not just a data one — nothing
// here changes that list's membership. `setHabitTemplate` (src/db/habits.ts),
// the chooser's write path, is typed to exactly this set.
export const GENERIC_TEMPLATE_KINDS = [
  "number", // Plain/number — a figure, its unit, its target.
  "check", // Done-or-not — a yes/no for today plus the streak.
  "duration", // Duration — minutes/hours plus the weekly total.
  "checklist", // Checklist — the habit's own named sub-items, ticked daily.
  "streak", // Streak-forward — the current streak takes the hero slot.
] as const;

export type GenericTemplateKind = (typeof GENERIC_TEMPLATE_KINDS)[number];

// The six kinds with real setup, shaped by config-schemas.ts, plus `hobby`
// (config-free, but never offered by the chooser either — see above). Each
// keeps its original slug as its kind — it's the value already stored on
// every migrated habit row, and renaming it would be its own migration for
// no behavioral gain. Collected through /config (or, later, a "suggest" AI
// call), not the simple chooser — see config-schemas.ts for what each holds.
export const RICH_TEMPLATE_KINDS = [
  "treino", // Workout — a weekly plan, exercises per day, effort.
  "leitura", // Reading — a yearly goal and a book list with pace.
  "sono", // Sleep — a target bedtime/wake window.
  "rotina", // Routine — named time blocks, followed or not.
  "duolingo", // Languages — lessons per active language.
  "espiritualidade", // Spirituality — named practices, some countable.
  "hobby", // Hobby — free-text activity and minutes, no setup at all.
] as const;

export type RichTemplateKind = (typeof RICH_TEMPLATE_KINDS)[number];

// What a template kind resolves to once null is normalised away.
export type TemplateKind =
  | GenericTemplateKind
  | RichTemplateKind
  | typeof PLAIN_KIND;

// What a generator is allowed to PROPOSE UNPROMPTED, and what the habit
// creation form offers for a brand-new habit. Deliberately still just one
// entry: a model or a form defaulting someone into "Workout" or "Reading"
// with no setup behind it is a bigger initiative than offering it in the
// chooser, where a person picks it and fills it in themselves. Widening this
// is explicitly deferred — see the Phase 3 plan's "explicitly deferred"
// section.
export const SUGGESTABLE_TEMPLATE_KINDS = [PLAIN_KIND] as const;

export type SuggestableTemplateKind =
  (typeof SUGGESTABLE_TEMPLATE_KINDS)[number];

export function isGenericTemplateKind(
  value: string | null
): value is GenericTemplateKind {
  return (
    value !== null &&
    GENERIC_TEMPLATE_KINDS.includes(value as GenericTemplateKind)
  );
}

export function isRichTemplateKind(
  value: string | null
): value is RichTemplateKind {
  return (
    value !== null && RICH_TEMPLATE_KINDS.includes(value as RichTemplateKind)
  );
}

// The single normalisation: a stored NULL or an unrecognised string means the
// generic renderer. Unrecognised is folded into plain on purpose — a row
// written by a future version of the app should render plainly on an older
// deploy rather than crash it.
export function templateKindOf(value: string | null): TemplateKind {
  if (isGenericTemplateKind(value)) return value;
  if (isRichTemplateKind(value)) return value;
  return PLAIN_KIND;
}

// A habit is eligible for the card-style chooser when it isn't one of the
// seven kinds the chooser has no card for (the six rich kinds plus `hobby`) —
// unchanged from before Phase 3. That used to be a safety rule (those seven
// were owner-shaped and dangerous to touch); it's now purely a UI-surface
// rule (the chooser has nowhere to send a "reassign my workout plan" click),
// but the visible result — which habits show up in `/habits/templates` — is
// identical either way, which is the point: nothing about this screen should
// look any different than it did before this phase.
export function isChoosableTemplateKind(value: string | null): boolean {
  return !isRichTemplateKind(value);
}

// The chooser's "suggested" badge, computed live rather than stored: a
// habit's metric type already implies which of the three simple kinds fits,
// so nothing needs remembering until the user actually confirms one — see
// UX_PRINCIPLES.md, "a suggestion looks like a suggestion until it is
// touched". Checklist, Streak-forward, and the six richer kinds have no
// metric-driven default: each is equally sensible on any metric (or requires
// its own setup regardless), so offering one as "suggested" would be a guess
// dressed up as a recommendation.
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
// flag. Set only from a Server Action
// (src/app/(app)/templates-nudge-actions.ts); read from the Today page,
// which can only read cookies, not write them.
export const TEMPLATES_NUDGE_SEEN_COOKIE = "templates_nudge_seen";
