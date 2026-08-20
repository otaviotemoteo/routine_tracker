# Habit vs. Activity — the model

This file has been cited by name — in `docs/ARCHITECTURE.md`, `docs/UX_PRINCIPLES.md`,
`src/db/habits.ts`, `src/db/habits.test.ts`, `src/lib/ai/habit-suggester.ts`,
`src/lib/ai/activity-proposer.ts`, `src/lib/i18n.ts`, and the onboarding activities
page/actions — since before it existed. It exists now, and it names the model those
citations meant.

## Four layers, one axis of zoom

```
life domain  →  habit (umbrella)  →  activity (concrete, checkable)  →  a day's log
"Saúde"          "Cuidado com          "Treino"           "Corrida"       done, details
                  o corpo"
```

Each step zooms in. A **life domain** is one of the twelve fixed areas the values
assessment is built on. A **habit** is the umbrella living under it — a name, a
domain, a lifecycle (proposed / tracked / archived) — with no metric and no setup
of its own. An **activity** is the concrete, independently-measured, independently-
checkable thing living inside a habit: it carries the metric spine (binary / count
/ duration, unit, target, minimal action) and, for the richer kinds, its own setup
(a workout plan, a reading list, a set of routine blocks, languages, spiritual
practices). A **day's log** is one check against one activity.

A habit can have one activity (the common case — "Leitura" habit, one "Leitura"
activity) or several ("Cuidado com o corpo" habit, with a "Treino" activity and a
"Corrida" activity, tracked and shown separately). Nothing about the model requires
more than one; nothing about it caps it at one either.

## Why the split, not just a richer habit row

Before this model, `templateKind` and `config` — and the metric spine itself,
`metricType`/`unit`/`target`/`minimalAction` — lived directly on `habits`. That
made a habit and its one trackable thing the same row, which broke the moment an
umbrella needed more than one concrete thing under it: two activities of the same
kind under the same account had no way to coexist without one promotion silently
overwriting the other's config (`promoteToRichKind`'s whole reason for keying on
a specific habit id, not "the account's one habit of a kind" — Decision 3, below).
Splitting the two is what makes "an umbrella can hold more than one concrete thing"
representable at all, and it's what let `daily_checks` move to checking the thing
that's actually measured — the activity — rather than the umbrella that merely
organizes it.

## Decision 3: generation always creates, never merges

`promoteToRichKind`'s doc comment named this "decision 3" before this file existed
to hold it. Restated for its successors, `proposeActivity`/`acceptActivity`:
**generating an activity always inserts a new row. It never updates an existing
one in place.** Two activities that both want to be "treino" — an older one and a
freshly generated one — must never be able to silently merge into a single config,
because that would combine two things that never asked to be combined. Keying every
write on the specific activity id it was given, never on "the one of this kind,"
is what makes that structurally impossible rather than merely discouraged.

This is also what retired `getHabitByTemplateKind`'s "oldest wins" rule outright,
rather than replacing it with an activity-shaped equivalent of the same ambiguity:
once every activity is addressed by its own id, or by the specific habit it
belongs to, there is no more "the account's one X" to resolve — the question the
old function existed to answer no longer has anything to be ambiguous about.

## The default-activity invariant

Every tracked habit has **exactly one activity from the moment it becomes
tracked** — created in the same write that activates the habit, `templateKind:
null`, carrying whatever metric fields the habit form (or the generator) supplied.
This is what keeps "a habit with no rich activity yet" a harmless, ordinary state
rather than a broken one: Today still shows one plain card, because the habit
always had one activity — it just never got a richer one. Declining
`/onboarding/activities` for a habit, or never visiting `/config` to add a second
activity, costs nothing and breaks nothing.

**A still-untouched default activity is retired, never deleted, the first time a
real activity is accepted for that habit** — but only if it has no logged history
of its own. A default activity someone has actually been checking off is left
alone; retiring it would erase a card someone was using, which is exactly the
class of bug `HabitEdit`'s `?: never` guard exists to prevent one layer up. A
*second* activity added later, once a habit already has a real one, never touches
this retirement path at all — there's no more placeholder to retire.

## The proposed → accepted lifecycle exists at both layers, for the same reason

`habits.active_from IS NULL` means proposed, not yet tracked — invented so a
5–20 second generation call survives a refresh instead of living only in client
state. `activities.active_from` carries the identical meaning, for the identical
reason, one layer down: `activity_proposer`'s calls run tens of seconds to minutes
(see `docs/BLOCKED.md`), and a proposal a person hasn't reviewed yet must survive
a backgrounded tab exactly as a proposed habit already does.

## What an AI generator may and may not decide, restated one layer down

`habit_suggester` may propose a habit's name, its domain, a minimal action, and
`why` — never a rich kind (`SUGGESTABLE_TEMPLATE_KINDS` has exactly one member,
`plain`) and never a metric target. `activity_proposer` may propose a kind-
appropriate `config` (a plan's days, a reading list, a set of blocks) for a kind a
**human already picked** — never a `metricType`, a target, or a frequency. "AI
never calculates" is a property enforced by the shape of both generators' output
types, not a sentence in either prompt — a schema is a wall, a prompt is a request.

## What this model does not settle

Whether an activity can itself have sub-parts with independent daily state beyond
what `config`'s per-kind shape already holds (a workout's days, a routine's
blocks) is not a question this model answers — those are already handled inside
a single activity's own `config`, keyed by weekday where it matters (see
`src/lib/config-schemas.ts`'s header comment on why no separate recurrence table
was needed: a workout's `days[]` already carries distinct content per weekday,
and a routine's `blocks[].weekdays[]` already carries which days a block repeats
on — both patterns live inside one activity's JSONB, not as a fourth layer).
