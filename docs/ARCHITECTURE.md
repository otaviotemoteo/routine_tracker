# Architecture — Personal Habit Tracker

A small multi-user web app for daily habit check-ins with weekly and monthly consistency views.

**One sentence:** open the app, check off what I did today, see my consistency over the week and the month.

This document explains *how* the system is built and *why*. For scope, screens and the day-by-day plan, see `../README.md`.

---

## System Overview

```
┌─────────────────────────────────────────────────────┐
│  Browser (desktop / mobile)                          │
│  React Server Components + small client islands      │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│  Next.js 14+ (App Router) on Vercel                  │
│                                                      │
│  middleware.ts ── auth gate (signed cookie → user id) │
│       │                                              │
│  app/api/checks/*  ── thin route handlers            │
│       │              (input validation only)         │
│  src/db/queries.ts ── data-access layer              │
│       │              (all Drizzle usage lives here)  │
│  src/db/schema.ts  ── Drizzle schema                 │
└──────────────────────┬──────────────────────────────┘
                       │ serverless driver
┌──────────────────────▼──────────────────────────────┐
│  Neon (PostgreSQL, serverless)                       │
│  users, habits, daily_checks + entity tables         │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 14+ (App Router) | RSC-first, already familiar |
| ORM | Drizzle | Type-safe, lightweight, already in use |
| Database | Neon (PostgreSQL) | Serverless, zero config, already in use |
| Auth | Custom middleware + signed cookie + PBKDF2 | A closed set of accounts created by script; Auth.js would be overkill |
| Styling | Tailwind | Tokens for the "Canteiro" design system |
| Fonts | Fraunces / Jost / JetBrains Mono | Display / body / numeric data |
| Deploy | Vercel | Zero config for Next.js |

## Layering (the core rule)

Three strict layers, dependencies pointing downward only:

1. **Route handlers** (`app/api/checks/**`) — thin. They parse and validate input, call one function from the query layer, and shape the HTTP response (status codes, JSON errors). No Drizzle, no SQL, no business math here.
2. **Query layer** (`src/db/`) — the only place that touches Drizzle. Nothing outside this directory imports it. `queries.ts` holds the tracker (fetch-or-create today's checks, toggle a check, week window, month stats), with per-area siblings beside it: `users.ts` for accounts, `assessment.ts` for the values layer. Business calculations (streak, adherence %, the diagnostic patterns) are delegated to pure helpers.
3. **Schema** (`src/db/schema.ts`) — Drizzle table definitions, mirrored by TypeScript interfaces in `src/types/habit.ts`.

Pure helpers live in `src/lib/utils.ts` (date/timezone handling, streak and adherence math). They take plain data in and return plain data out — no I/O — which keeps the tricky logic trivially testable.

Server Components fetch through the API routes' underlying query functions; client components ("islands") exist only where interactivity demands it (`HabitCard` toggle, week/month navigation).

## Data Model

Everything belongs to one account through `user_id`, `habits` included (see
"Data ownership"). `life_domains` is the only shared table left.

```
users                    habits                    daily_checks
─────                    ──────                    ────────────
id      SERIAL PK        id      SERIAL PK         id          SERIAL PK
name    VARCHAR(40)      user_id FK → users.id     user_id     FK → users.id
handle  VARCHAR(40)      name    VARCHAR(50)       habit_id    FK → habits.id
        UNIQUE           slug    VARCHAR(50)       checked_at  DATE (no default!)
password_hash TEXT               UNIQUE(user,slug) done        BOOLEAN default false
        NULL = unclaimed domain_id FK → life_domains
first_run_step VARCHAR(30)  metric_type/unit/target details    JSONB (Tier 2)
        NULL = no run open  minimal_action         note        TEXT
created_at TIMESTAMPTZ   template_kind / config
                         source / why
                         active_from  NULL = PROPOSED
                         active_to    NULL = still tracked
                         position

                             UNIQUE(user_id, habit_id, checked_at)
                             INDEX on (user_id, checked_at DESC)
```

- **`habits` used to be seven globally shared rows with no owner.** That was the
  modelling error that stopped anyone else from using the app: it normalised
  what is *personal* into schema. `bun run db:migrate:habits` clones the seven
  per account, repoints every existing `daily_checks` row, and swaps
  `UNIQUE(slug)` for `UNIQUE(user_id, slug)` — so two people can both track
  "leitura". A brand-new account gets **no** habits and Today shows an empty
  state until they build some, which is correct: a friend's habits come out of
  their own assessment.
- **`active_from IS NULL` means proposed, not tracked.** A generated habit is a
  real row written the moment it is generated, so a 5–20 second model call
  survives a backgrounded tab or a refresh — but it is invisible to Today, the
  day flow, the streak, the week grid, the month view and the export until
  "Start tracking" fills the column in. "Nothing persists until you start" is a
  statement about what reaches Today, not about what reaches the database, and
  separating the two costs one nullable column. The filter lives in exactly one
  place, `habitsFor()` in `src/db/scope.ts`, so no caller can forget it.
- **`active_to` is why a tracked habit is never deleted.** Removing one sets the
  end of its window; `daily_checks` still reference the row, and a habit you
  kept for three months is part of the record even after you stop. A *proposal*
  is deleted outright — nothing can reference it, and what was proposed is still
  in `ai_runs.output`, so the rejection rate survives the delete.
- `daily_checks` holds one row per habit per day. Rows are lazily created: the first GET of a given day inserts one check per live habit with `done = false` as a single multi-row `INSERT … ON CONFLICT DO NOTHING` — one atomic statement (the neon-http driver has no interactive transactions), with the UNIQUE constraint guaranteeing idempotency under concurrent first-loads. The insert is scoped by `habitsFor(userId, date)`, so a removed habit stops materialising checks and a proposal never starts.
- The `optional` flag drives presentation and scoring: optional habits render with a dashed border and are excluded from the daily progress bar and from best/worst weekly summaries.

### Templates: why a new habit is always plain

`template_kind` decides how a habit renders — its Today card, its grid cell, its
check-in sheet, its summary sentence. `NULL` is the generic renderer; the seven
legacy kinds equal their old slug (`leitura`, `treino`, …).

**Only the owner's migrated rows may carry a legacy kind, and that is a
constraint rather than a leftover.** The seven rich renderers are not merely
un-extracted, they are *owner-shaped*: each reads a per-domain table (`books`,
`reading_goals`, `workout_plans`, `routine_blocks`, `spiritual_practices`,
`languages`) whose every row belongs to the one account that filled them in
through `/onboarding`, and their kinds are that account's Portuguese slugs. A
habit with `template_kind = 'leitura'` on a new account renders a reading card
with no current book, no page target and no pace — a broken screen, not a
degraded one.

So `SUGGESTABLE_TEMPLATE_KINDS` in `src/lib/templates.ts` has one member,
`plain`, for everyone including the owner, and both the habit form and the
generator's Zod enum read it. Widening the list once the renderers read a
habit's own `config` is a one-line change to that constant.

## v2 — Rich tracking (three tiers)

v2 turns the binary spine into an auditable dataset without disturbing it. Three tiers, additive:

1. **Spine (Tier 1):** `daily_checks.done` — unchanged. The grid, streaks and adherence % read only this and never regress.
2. **Daily details (Tier 2):** `daily_checks.details JSONB` + `note TEXT`. `details` is habit-specific and **validated by a Zod schema on every write** (`src/lib/details-schemas.ts`, one per slug, `.strict()`). `NULL` details = "done without details" (v1 rows and quick-toggle days) — valid forever.
3. **Entities (Tier 3):** normalized tables for things with a lifecycle beyond a day — `workout_plans`(+`_days`), `reading_goals`, `books`, `routine_blocks`, `spiritual_practices`, `languages`. `details` references them by id/slug. **Workout plans are immutable & versioned** (edit = insert `version+1`, flip `active`); the change log is `ORDER BY version`, no audit table.

`src/lib/details-schemas.ts` is the single source of truth: it validates writes, generates the TS types (`z.infer`), and feeds `DATA_DICTIONARY.md` via each field's `.describe()`. All Tier-3 access stays in `src/db/queries.ts` like the spine. Derived metrics (reading pace, routine/plan adherence) are pure helpers in `src/lib/utils.ts` — computed, never stored.

## Route groups & persistent shell (v2)

The authenticated app lives in an `app/(app)/` route group whose layout renders the `NavBar` **once** — it persists across navigations instead of remounting per page (the real cause of the old "reload" flash; all navigation was already `next/link`). `/login` and `/onboarding` sit outside the group and get no NavBar. `/semana` and `/mes` are permanent redirects into the `/overview` Week|Month toggle (`next.config.ts`).

## Onboarding (v2, reconciled)

**The first run is the values chain, not a manual wizard.** The `(app)` layout gates the app on one predicate — `countTrackedHabits(userId) === 0` (`src/db/habits.ts`) — and redirects a brand-new account to `/assessment`, which walks values → priority areas → written directions → AI-suggested habits → `/habits/review` → "Start tracking" → Today (see "The values layer (M1)" and "The AI layer (M2)" below for the chain itself). Completion is derived from the database — an active habit exists or it doesn't — not from a cookie, so it survives a cleared browser or a second device. There used to be a separate `onboarded` cookie and an `isConfigured()` check against six manual-entry tables; both are gone. `src/components/assessment/IntroStep.tsx` carries the framing for this: since it's now the first screen a new account ever sees, it explains the whole journey (priorities, directions, AI habits, then a short daily check-in), not just the twelve-question grid.

**`/onboarding?step=…`, the original 8-step manual wizard, still exists but is no longer the gate.** Each step is a form whose server action upserts an entity table and redirects to the next step (via a hidden `next` field), so abandoning mid-way loses nothing. The dynamic steps are client components that serialize their rows into one hidden JSON field. Nothing links to `/onboarding` anymore — it's reachable only by URL — because `/config` already exposes the same six sections independently (`src/app/config/page.tsx`'s own index), reusing the identical step components with `next="/config"`, saving in place instead of advancing. That's the practical "set up richer detail for a habit" surface now. Prefill loaders are shared in `src/lib/onboarding-prefill.ts`, and `src/lib/setup-summary.ts` builds the one summary rendered by `/config`'s index and the Overview **Activities** section (below the week/month chart) — so the two never drift. Because `/onboarding` and `/config` sit outside the `(app)` group (no NavBar), each renders its own `LanguageSelect`.

The six manual-entry tables (workout plans, books, routine blocks, languages, spiritual practices, sleep targets) remain account-singleton, not per-habit — see "Templates: why a new habit is always plain" below. Wiring AI-suggested habits into richer, per-habit activities is deliberately out of scope here; it needs that constraint lifted first.

Books are reconciled **by id** (`saveReadingList`): existing rows update, new ones insert, and only removed-and-untouched books are deleted — a book with progress or a done/abandoned status is never deleted, since past `details.book_id` references it.

## The values layer (M1)

The tracker records what you did. The values layer records **what you said mattered**, so that the two can be compared. It is additive: it shares only the `users` table with everything above, and nothing in the tracker reads it.

**Shape.** `life_domains` (12 seeded rows, the one table with no owner) → `cycles` (a half-year, derived from the date, no UI) → `assessments` → `assessment_ratings` (six 1–10 answers per domain) and `direction_narratives` (one written direction per priority domain). No display text is stored: names, descriptions, boundary notes and writing prompts live in `src/lib/i18n-assessment.ts` keyed by slug, because the app is bilingual and `habits.name` already shows what it costs to bake one language into a table.

**Draft, then sealed.** This is the one place where "append-only" and "every step saves on advance" appear to collide. They don't: an assessment is **mutable while `completed_at IS NULL` and immutable forever once it is set**, because a draft isn't the record yet. Since neon-http has no interactive transactions, each guard is a predicate inside a single statement rather than a read-then-write:

- a rating write is an `INSERT … SELECT … FROM assessments WHERE id = ? AND user_id = ? AND completed_at IS NULL … ON CONFLICT DO UPDATE`, so ownership and the seal are checked in the same round trip;
- a partial unique index (`assessments (user_id) WHERE completed_at IS NULL`) makes two open drafts unrepresentable;
- sealing only fires when all twelve ratings are present, and a double-tapped Continue returns no row, which means "already sealed" and not an error.

**The engine is pure.** `src/lib/diagnose.ts` takes a grid and returns patterns, distances and a ranking with no I/O, so it is tested directly (`bun test`). It ranks by the **raw** value-action gap, not a z-score: within one assessment, subtracting a column mean cannot change the ordering, and standardising the two columns separately would silently weight them by their own spread — importance answers cluster, so its deviation is small, and the ranking would stop being about action at all. Z-scores earn their place as `gapSpread()`, which tells the results screen when the domains are too bunched for the cut at five to mean much.

**One thing is stored that could be computed.** `assessments.priority_domains` freezes the top-five cut at sealing time. Recomputing it on read would let a later change to `THRESHOLDS` rewrite which domains a past cycle prioritised, while its direction narratives sat attached to domains no longer on the list, which is history rewritten by a deploy.

**"Include another area" never rewrites that column.** The areas review lets you
add a sixth area, and the mechanism is that adding one simply *means writing a
direction for it*: `buildingAreas()` in `src/lib/assessment.ts` derives the set
the cycle is built on as the frozen cut plus any area with a narrative. Deriving
it rather than storing it is what keeps the engine's record of what it said
intact while still letting a person overrule the arithmetic — and one function
means the areas screen and the habit generator cannot disagree about which areas
the cycle is about.

**Focus mode.** `/assessment` sits outside the `(app)` group, so there is no NavBar to wander off through mid-grid and it renders its own `LanguageSelect`, exactly as `/onboarding` and `/config` do. `src/lib/assessment.ts` is the third instance of the wizard mechanic (after `onboarding.ts` and `daily.ts`); the one thing it adds is a ceiling — `resolveAssessmentStep` clamps a requested step to the first unanswered domain, so backwards is free, forwards is impossible, and the results screen cannot be reached before the grid is finished. That is arithmetic rather than a hidden button, because a UI convention is one URL edit away from being ignored.

**Scripts.** `bun run db:migrate:assessment` creates the layer (idempotent, one transaction, `pg` over TCP). `bun run assessment:seed <file.json>` backfills a grid answered on paper, through the same Zod schema and the same `prioritize()` the app uses, and refuses to overwrite a sealed assessment. In that file `ratings` is optional: a file carrying only `directions` writes the written half alone, which is what you want when the numbers will be answered in the app but the reflections already exist on paper. Seed them first and the writing step opens with your own words in it, to review rather than retype. It never prefills a rating.

## The AI layer (M2)

The values layer says what mattered; the tracker records what got done. The AI
layer is the seam: it reads what someone wrote about the areas they chose and
proposes habits for them. It is **the thinnest and most replaceable layer in the
app**, and the architecture exists to keep it that way — a provider can be
swapped, added or removed, and the whole thing can be deleted, without touching
the data model or a single screen.

**The chain.** Directions complete → the "Cycle set" dialog → `/assessment/areas`
(the review) → Generate → `/habits/review` (the proposals) → Start tracking →
Today.

### The harness is the whole design

`src/lib/ai/harness.ts` holds everything a generator needs to run safely, so a
generator itself is only a schema, a prompt and a name.

```ts
type RunOutcome<T> =
  | { status: "ok"; data: T; provider: string; cached: boolean }
  | { status: "unavailable" }   // decided BEFORE any I/O
  | { status: "invalid" }       // the shape was wrong
  | { status: "error" };        // every provider failed
```

**`runGenerator` never throws.** Every failure — no key, no quota, a network
error, a malformed answer — comes back as one of those four, and every non-`ok`
outcome renders the same manual path. A failed model call must never be able to
strand somebody mid-flow.

Three rules do the load-bearing work:

1. **`unavailable` is decided before any I/O.** No provider has a key, or
   today's quota is spent. That is what lets the Generate button be *absent*
   rather than present-and-failing, which is a materially different experience
   from a button that throws when pressed.
2. **Rotate on `error`, never on `invalid`.** A provider that was unreachable,
   slow or rate-limited says nothing about the next vendor, so rotate. A
   *malformed* answer means the prompt is wrong or the schema asks for something
   no model can produce — every other provider will fail identically, so trying
   them spends two more calls to arrive at the same place and hides the real
   fault behind what looks like an outage.
3. **The prompt is never logged.** `ai_runs.error` is a truncated, scrubbed
   string; anything shaped like a key is stripped, because provider SDKs
   sometimes put the whole request into an error message.

`src/lib/ai/providers.ts` is the **only** module that reads a key and carries
`import "server-only"`, so importing it from a Client Component is a build error
rather than a runtime surprise. The rotation order is Google (Gemini) → Groq →
OpenAI: three independent vendors, so one outage cannot take all of them.

### One table does three jobs

`ai_runs` is the record, the cache and the quota counter, with one row **per
attempt** — which is what makes a failover legible afterwards as two rows with
`attempt` 1 and 2 and different providers. The cache key hashes the generator,
its `promptVersion` and the input, so editing a prompt invalidates every cached
answer for it. The quota is `count(*) WHERE created_at >= today AND cached =
false` — durable, unlike the login limiter it deliberately does not share a
mechanism with, because a cold start cannot reset a count of rows.

### What the model is not allowed to do

Enforced by the shape of the type in `src/lib/ai/habit-suggester.ts`, not by a
sentence in a prompt. A prompt is a request; a schema is a wall.

- **No `config`.** Letting a model write JSON into a JSONB column is the failure
  mode the whole schema-validated design exists to prevent. It picks the *kind*;
  the config is filled by that template's own setup step.
- **No numeric fields at all** — no target, no count, no frequency. "AI never
  calculates" is a property of the output type. The target is a form field a
  human fills.
- **No template that cannot render** — `templateKind` is
  `z.enum(SUGGESTABLE_TEMPLATE_KINDS)`, one member this phase (see "Templates"
  above). The field is kept rather than dropped so the kind still arrives *with*
  each habit in the same call, and widening the list later touches one constant.

**"Findings are empty" is a first-class branch of the prompt, not an edge case.**
The only sealed assessment this was developed against produces zero findings
across all twelve areas — importance and possibility sit near 10 almost
throughout, so nothing crosses a threshold. A prompt that leaned on findings
would therefore have been built and judged entirely on its degraded path, and
would have looked fine while being untested.

### Suggestions persist immediately, as invisible rows

The obvious reading of "nothing persists until Start tracking" is to hold the
set in a client island. **Rejected**: this is a phone-first app and generation
is a 5–20 second call that costs a quota unit, so a backgrounded tab, a rotation
or an accidental refresh would lose the whole set and charge for it again.

Instead the output is written straight to `habits` with `source =
'ai_suggested'` and `active_from = NULL` — real rows no user-facing read can
see. `/habits/review` then:

| Action | Effect |
|---|---|
| load the screen | reads the un-started rows; **generates only when there are none**, so a refresh is free and costs no quota |
| Edit | `UPDATE`, flipping `source` to `ai_edited` |
| Remove | `DELETE` — safe, because nothing can reference an inactive habit |
| Add a habit | same form, `source = 'human'`, also `active_from = NULL` |
| Start tracking | one `UPDATE … SET active_from = today WHERE active_from IS NULL`, then Today |

Generating also requires `?generate=1`, which only the areas screen's button
puts in a URL, so the consent step stays meaningful and typing the URL spends
nothing.

**Rejection rate survives a deleting Remove**: the denominator comes from
`ai_runs.output`, which holds what was *proposed*, against
`habits.source = 'ai_suggested' AND active_from IS NOT NULL` for what was kept.

### When all three providers are down

`ai_pending_requests` gets one row and the user falls straight through to the
manual form. The retry is **not a queue and not a cron**: an unresolved row is
re-attempted on the next visit to `/habits/review`, and `/habits` carries a
quiet, non-blocking line pointing back. It resolves when a retry succeeds *or*
when the user presses Start tracking with hand-written habits — at that point a
human has satisfied the request, and regenerating over a finished set would be a
second surprise after they thought they were done.

### Prompt injection

The direction narrative is user-written free text that reaches a model — the
first place in this app where somebody's typing becomes part of an instruction.
The mitigations are honest rather than absolute, and are written out in
`docs/SECURITY_REVIEW.md` §6: schema-constrained output, `templateKind` as an
enum, no numeric fields, nothing executed, and every field landing in a form a
human reviews before anything is tracked.

## Error reporting (M2)

`@sentry/nextjs`, errors only: `tracesSampleRate: 0`, **no Session Replay**,
no dashboards. That is the entire observability scope. Replay records the DOM,
and the DOM here is somebody's assessment answers and the paragraph they wrote
about their marriage — masking would be a setting to get wrong once, whereas not
installing it is a decision that stays made.

`src/lib/sentry-scrub.ts` is the one place the rules live, shared by all three
runtimes because a rule in three files is a rule that will be right in two of
them. Two lines of defence, deliberately overlapping:

1. **`dataCollection`, which stops the SDK collecting in the first place.** Every
   category is named explicitly — cookies, request and response headers, all
   HTTP bodies, URL query params, `userInfo`, database query data, stack-frame
   locals, `genAI` inputs and outputs. **This must never be shortened.** It
   replaced `sendDefaultPii: false` (deprecated in v10, removed in v11), and the
   migration is not a rename: `sendDefaultPii: false` denied everything, whereas
   passing a `dataCollection` object flips every category *not* named to its own
   permissive default, most of which are `true`. `dataCollection: {}` would
   therefore be the single most damaging edit anyone could make to this repo.
   The object is `satisfies`-checked against the SDK's own options type so a
   misspelled key is a compile error rather than a silent re-enable — without
   that, an untyped const passed to `Sentry.init()` skips excess-property
   checking entirely.
2. **`beforeSend`, which scrubs what still got through.** The auth cookie,
   headers, request bodies and query strings are deleted whole; anything
   key-shaped like `narrative`, `reflection`, `prompt` or `rating` is redacted
   at any depth; and `user` is reduced to the integer id, never the handle —
   which in this app is a person's name *and* their login.

Harness non-`ok` outcomes go as **breadcrumbs, not exceptions**. A provider
being down is an expected outcome of a three-provider design, is already
recorded in `ai_runs`, and paging on a working failover trains you to ignore
alerts.

Without a DSN the SDK is inert, which is what keeps local development and a
credential-free build machine working unchanged.

**Every event is tagged with its environment and release.** `environment` comes
from `VERCEL_ENV` (`production` | `preview` | `development`) so a crash your
friends hit and a crash on a throwaway branch preview are never the same row —
untagged, everything lands in Sentry's catch-all "All Envs" and the alert worth
reading is the one you learn to scroll past. `release` is the commit SHA, which
is also what `sentry-cli releases propose-version` emits, so events attach to
the release a deploy created.

The off-Vercel fallback is the literal `"development"`, **not `NODE_ENV`**, and
that is a fix rather than a preference: bun sets `NODE_ENV=production` when it
runs a script, so a `NODE_ENV` fallback filed local runs under `production` —
exactly the mixing the option exists to prevent, failing in the most expensive
direction. `src/lib/sentry-scrub.test.ts` guards it.

## Product analytics (M2)

`@vercel/analytics` and `@vercel/speed-insights`, mounted once in the root
layout. Both are first-party through Vercel, set no cookie and fingerprint
nobody, and record the **route** rather than the URL — which is the property
that matters here, since `?domain=family` would say which part of somebody's
life they were reading. Both are inert unless switched on in the Vercel project,
so a local run and a fork cost nothing.

This is a deliberate widening of the "errors only, no dashboards" scope written
above: page views and Core Web Vitals answer "is anyone still using this in week
three?", which is the question the whole app is judged on, and neither carries a
person's content.

**This setup diverges from Sentry's own recommended defaults, on purpose.** Their
Next.js guide recommends errors *plus* tracing plus Session Replay, and says not
to pare the base `init` back to errors-only. Three deliberate departures:
`tracesSampleRate: 0`, no Replay, and no `tunnelRoute`. The first two are the
scope decision above; the third is because a tunnel needs a public route while
the middleware protects everything else, and an unauthenticated proxy endpoint
is a bigger thing to own than ad-blocker evasion is worth at this size. Each is
a one-line change if the trade ever stops being worth it.

## Onboarding churn (M2)

One nullable column, `users.first_run_step`, and that is the whole feature.

The first run already saves on advance, so *where* somebody stopped was always
derivable from the rows they left behind. The only thing missing was knowing a
run had stopped at all. So the column is written on each advance and **set back
to NULL when the run completes** — which makes any non-null value, by
construction, an abandonment, and leaves a finished run with nothing behind it.

```sql
SELECT first_run_step, count(*) FROM users WHERE first_run_step IS NOT NULL GROUP BY 1;
```

Vocabulary in `src/lib/first-run.ts`: `assessment:<slug>` ×12 → `results` →
`directions:<slug>` → `areas` → `habits`. Each write is folded into an action
that was already writing on advance. No per-step columns, no runs table, no
screen — it is a question asked rarely, by the one person who runs the app.

## Timezone Handling (the most important decision)

**The check date never comes from the database.** Neon and Vercel run in UTC, so a `DEFAULT CURRENT_DATE` would roll the day over at 21:00 São Paulo time — checks made at night would land on the wrong day.

Instead:

- `checked_at` has **no default** in the schema.
- A single helper, `todayInSaoPaulo(): string` (`YYYY-MM-DD`), computes "today" with an explicit `America/Sao_Paulo` timezone and is the only sanctioned way to determine the current day.
- Every query receives the date as an explicit parameter.
- Raw `new Date()` is never used to determine "which day it is" anywhere in the codebase.

## Business Rules

Encoded in `src/lib/utils.ts` and enforced everywhere:

1. **Week starts on Monday** (Mon–Sun) in every screen and calculation. The week API validates that the `start` parameter is a Monday.
2. **Streak doesn't break on an unchecked today.** Streak = consecutive done-days counting backwards from *yesterday*, plus one if today is already done. (Otherwise every streak would read zero each morning.)
3. **Monthly adherence** = done days ÷ *elapsed* days of the month (day 1 through today, inclusive) for the current month; past months use the full day count. This prevents the depressing 16%-on-day-5 effect.
4. **Optional habits never penalize.** They show everywhere but count nowhere.
5. **Guided daily flow (v2.1).** *All* logging happens at `/day?step=<slug>` — one habit per step, prefilled from the user's configured goals ("Did you do Workout today? · Chest + triceps · Bench press 4×8"), with the same progress/skip mechanics as onboarding. Each step's Save writes that habit's `details` (validated) **and** flips `done` in one `PATCH /api/checks/:id`, then advances. The spine never depends on details being filled — skipping a step leaves the check untouched.
6. **Config edits are dirty-gated and return to their origin.** Every onboarding step now tracks whether its fields differ from what was loaded (`dirty`, a `JSON.stringify` snapshot comparison taken once on mount). In `/config` (not the onboarding wizard — clicking through defaults there is normal), Save stays disabled until something changes, and Back/Skip route through a shared nav guard: dirty → an "Unsaved changes" confirm dialog; clean → navigate immediately. Both Back and Save return to wherever the edit was entered from — `/config` by default, or `/overview` when reached from its Activities section (`?from=overview`) — so a change is seen where it was made, not buried in the settings list.
7. **Today is a status board, not a form.** It reports state and offers one action. Each card says whether the habit is done (with what it logged — "2/2", "+23 p") or what today expects of it (the planned focus, the current book and page, the sleep target, how many routine blocks) via `src/lib/card-status.ts`; "Complete daily" is the only way into the flow. Cards carry no controls, so the whole screen is server-rendered (no client JS). (Supersedes both the earlier per-card modal sheet — whose per-habit bodies in `src/components/sheets/` are now the flow's steps — and the per-card quick-toggle.)

## API Surface

```
GET    /api/checks?date=YYYY-MM-DD    today's 7 checks (lazily created)
PATCH  /api/checks/:id                { done }                  quick toggle (keeps details)
                                      { done, details, note }   sheet save (details Zod-validated per slug)
GET    /api/checks/week?start=...     7 days × 7 habits (start must be Monday)
GET    /api/checks/month?month=...    month's checks + adherence % + streak per habit
GET    /api/export?from&to            canonical dataset JSON (v2)
```

All routes sit behind the auth middleware. Handlers return proper status codes with JSON error bodies; every handler wraps its work in try/catch.

## Authentication & accounts

Small, closed and deliberately without Auth.js — a handful of people who all
know each other, so the machinery of a general auth provider buys nothing.

- **Accounts are created by script only** (`bun run user:create <name>`). There
  is no sign-up page and no API route that creates one. This is the security
  model: you can't register, so the only way in is a name someone gave you.
- **The login handle is a name, not an email.** `users.name` is the display
  form ("Sofia"); `users.handle` is its lowercase and carries the UNIQUE, so
  "Sofia" and "sofia" are one account. Nothing is ever emailed, so an address
  would be an unverifiable field to maintain.
- **First access claims the account.** `users.password_hash` is NULL until
  someone signs in with that name and chooses a password; the claim UPDATE
  carries `WHERE password_hash IS NULL`, so two people racing for the same name
  can't both win. Claiming also seeds that account's three default spiritual
  practices and drops the user into onboarding.
- **Sign-in is two steps** (`src/app/login/actions.ts`): name, then either the
  password or the first-access screen. An *unknown* name is routed to the
  password step and fails with the same wrong-credentials message, so the form
  can't be used to enumerate who has an account. Only an unclaimed name reveals
  itself — the accepted cost of the claim flow, and why names aren't published.
- **Passwords**: PBKDF2-SHA256, 600k iterations, Web Crypto only so the same
  code runs on the edge middleware and in Node (`src/lib/password.ts`). Stored
  as `iterations.salt.hash`, so the cost can be raised later without
  invalidating anyone's password. Rules live in `src/lib/password-rules.ts` and
  are read by both the live checklist and the server check, so the form can
  never accept what the action rejects.
- **No self-service password change.** `bun run user:password <name>` prompts
  for a new one. Deliberate: resets go through the owner.
- **The session cookie carries the user id**, signed:
  `userId.issuedAt.HMAC-SHA256(userId.issuedAt)`. The middleware verifies the
  signature only, so authorization costs no database round trip per request.
  The trade-off: deleting a user does not invalidate their cookie until it
  expires.
- **Every query is scoped to the signed-in user** — see "Data ownership".
### Login hardening

Protecting this one form is what keeps an attacker away from every per-user
query behind it — a perfect scope audit is worth nothing if the front door
opens. The policy is `src/lib/login-guard.ts`, the counters are
`src/db/login-attempts.ts`.

- **The counter is in Postgres** (`login_attempts`), replacing an in-memory Map.
  On a serverless deployment that Map lived per instance and died with it, so
  the old limit was in practice "five attempts per instance" — and instances are
  cheap for an attacker to get.
- **Progressive backoff before any block.** Two free attempts, then a delay
  doubling from 400ms to a 5s cap, spent *after* the password is found to be
  wrong. A growing delay makes automated guessing pointless; a hard cliff at
  five punishes the person who mistyped their own password twice and merely
  inconveniences the script.
- **Blocks by IP, never locks the handle.** The counter is kept for both, but
  only the IP one blocks. A handle-keyed lock would hand anyone a
  denial-of-service against a *named user*: this app's login **is** a person's
  name, and the set of names is small, so spamming one to lock its owner out
  costs nothing. The handle counter exists only to answer "is someone working
  through the account list from many addresses?".
- **The timing oracle is closed.** The wording was already identical for an
  unknown name and a wrong password; the clock was not — `!user` short-circuited
  before `verifyPassword`, so a nonexistent handle answered without paying
  600,000 PBKDF2 iterations. Both paths now verify, the miss path against
  `DUMMY_PASSWORD_HASH` in `src/lib/password.ts`.
- It also covers the name step, which is what makes guessing an unclaimed name
  impractical.

## Data ownership

Every per-user table carries `user_id`, `habits` included since the remodel.
`life_domains` is the one shared table (12 seeded rows, no owner), and
`workout_plan_days` reaches its owner through `plan_id`.

Two rules hold everywhere in `src/db/queries.ts`, `habits.ts`, `assessment.ts`
and `ai.ts`:

1. **Every function takes `userId` as its first argument**, resolved once per
   request by `requireUserId()` (pages/actions) or `getUserId()` (API routes,
   which answer 401 rather than redirect) — `src/lib/session.ts`.
2. **Every id-addressed write filters on the user too**
   (`WHERE id = ? AND user_id = ?`), so a check or book id belonging to
   somebody else matches no row instead of being mutated. Ownership is never
   inferred from the id alone.

Uniqueness that used to be global is per-account:
`habits(user_id, slug)`, `daily_checks(user_id, habit_id, checked_at)`,
`reading_goals(user_id, year)`, `spiritual_practices(user_id, slug)`,
`languages(user_id, slug)`.

### Scope by construction, and the honest limit of it

`src/db/scope.ts` defines `UserId` as a **branded number**. Only
`src/lib/session.ts` mints one, out of a cookie whose signature this process
verified, so a raw integer off a route param or a request body no longer
typechecks as a user id. Passing the wrong integer became a compile error
rather than a leak, and a cast is greppable — the only two in the tree are
inside `asUserId()` and `scriptUserId()` themselves.

Which modules the brand covers, stated rather than assumed:

| Module | Enforcement | Why |
|---|---|---|
| `queries.ts` | **branded** | every export already took `userId` first; the change was an annotation and the compiler found every call site |
| `habits.ts` | **branded** | newest and least-reviewed surface |
| `assessment.ts` | **branded** | the most intimate record in the app — the one the guarantee most needs to cover, and it cost the same as the others |
| `ai.ts` | **branded** | `ai_runs` rows carry output derived from someone's directions |
| `login-attempts.ts` | **manual audit** | pre-auth by nature: there is no user yet |
| `users.ts` | **manual audit** | genuinely pre-auth — `findUserByName` runs *before* a session exists, and `claimAccount`/`changePassword` take an id that is pre-session or script-only. Branding it would be a lie about when the value was authenticated |
| `migrate-*.ts`, `seed*.ts` | **manual audit** | `pg` over TCP, no session, operator-run |

The bottom three are not an oversight and must not be "fixed": the brand is only
worth having while it means one thing.

**What the brand cannot do** is prove that a query which received the right type
actually used it. That gap is covered behaviourally by
`src/db/isolation.test.ts` — two accounts, twelve assertions, every one of them
account A reaching for account B's ids and getting nothing. The full walk-through
is `docs/SECURITY_REVIEW.md`.

The same file exports **`habitsFor(userId, onDate?)`**, the single predicate for
reading a user's habits and the only place a user-scoped `from(habits)` is
written. It always includes `active_from IS NOT NULL`, so a proposed habit is
invisible everywhere by construction. `proposedHabitsFor()` is its complement
and has to be asked for by name.

### Migrating from the single-user shape

`bun run db:migrate` (`src/db/migrate-users.ts`) is a one-shot, re-runnable
script: it creates `users`, adds `user_id` everywhere, inserts the owner from
`APP_PASSWORD`, assigns every existing row to them, then sets the columns NOT
NULL and swaps the constraints. It runs over a plain Postgres connection (`pg`)
rather than the app's neon-http driver, because http has no interactive
transactions and a half-applied migration is the one outcome this must never
leave behind — and because that same connection works against local docker,
which is what makes it testable before it touches anything real.
`APP_PASSWORD` is read by this script and nothing else; it can be deleted once
the owner has changed their password.

## Frontend Architecture

- **Server Components by default.** Pages fetch data on the server; `"use client"` appears only in `HabitCard` (optimistic toggle) and navigation controls.
- **Screens:** `/` (Today: 7 cards + progress bar), `/semana` (GitHub-contributions-style 7×7 grid with prev/next week), `/mes` (per-habit adherence bar + streak with prev/next month).
- **Design system "Canteiro":** cream paper background, near-black forest-green ink, clover-green accent, hard offset shadows (`4px 4px 0`, never blurred), 2px borders, small-caps serif display type. In code the Tailwind tokens use English names (per Otávio's preference): `cream #F7F3E8` (papel), `forest #17281C` (mata), `clover #3D9B4F` (trevo), `mint #E3EFE0` (broto), `straw #D9A03F` (palha, streaks + the pending state), `sand #DCD9CC` (cinza-palha). Shared utilities `.display-title` and `.eyebrow` live in `globals.css`; hard shadows are the `shadow-hard{,-lg,-sm}` scale. Historical reference in `docs/identidade-visual.html` (gitignored).
- **No emoji anywhere in the UI.** Habit icons are lucide-react SVGs mapped from the habit slug in `src/lib/icons.ts`; the emoji stored in `habits.icon` is legacy seed data the interface never renders.
- **Today's state ownership:** `TodayChecklist` (client) owns the day's checks so the progress bar and the optimistic card flips move in the same render; `HabitCard` stays a dumb toggle. Rollback + a `role="alert"` message handle PATCH failures.
- **Mobile-first.** Primary usage is on the phone; touch targets ≥ 44px, visible focus states, `prefers-reduced-motion` respected.

## Internationalization

English is the default; Portuguese is one tap away from the selector in the top-right of every screen (landing header and `NavBar`).

- All copy lives in `src/lib/i18n.ts` as a single `COPY` record keyed by language, sliced per screen (`landing`, `nav`, `today`, `week`, `month`, `errorPage`).
- The choice is a non-httpOnly `lang` cookie, read on the server by `getLang()` (`src/lib/get-lang.ts`) and set on the client by `LanguageSelect`, which then calls `router.refresh()` — so translation happens during server rendering, with no client-side i18n bundle and no flash of the wrong language. `<html lang>` and the page metadata follow the same cookie.
- **Copy must be serializable**: it crosses from Server into Client Components, so values are strings with `{placeholders}` resolved by `format()` / `plural()` — never functions, which React cannot pass over that boundary.
- Dates are formatted with `Intl` using the selected locale (`formatDayLong`, `formatShortDayMonth`, `formatMonthLabel`), while the *timezone* stays `America/Sao_Paulo` regardless of language.
- Habit names are seeded in Portuguese and mapped to English by slug in `habitName()`; the database is never translated.
- The error boundary is the one exception: error boundaries are always Client Components, so it reads the cookie via `readLangCookieClient()`.

## Quality & UX Process

Development runs as a loop: assess state → build a phase → verify (`tsc --noEmit`, lint, dev server) → **UI/UX review** → commit → document → repeat.

Every phase that touches the interface is audited against a checklist covering visual hierarchy, toggle affordance, empty/loading/error states, mobile legibility, and the first-run experience (login → empty Today → first check). "It works" is not "it's good"; the loop iterates until the checklist passes.

**`UX_PRINCIPLES.md` is the standing output of that process** — the rules real usage has already settled (status vs. editing, how pending looks, guarded navigation, prefill and collapse, copy and a11y), each tied to the code that implements it, plus a checklist for new screens. Read it before building a screen; add to it when a review decides something new.

The loop stops only when every phase is complete and audited. What remains is the **human block**: creating the Neon database, filling `.env.local`, running migrations/seed, deploying to Vercel, and end-to-end testing on desktop and mobile.

## Deviations & Notable Choices

- **Tailwind v3, not v4**, so the design tokens live in `tailwind.config.ts` as the project contract asks. v4's CSS-first tokens would scatter them into `globals.css`.
- **Next 15 / React 19** ("14+" per README): async `searchParams`/`params` and `useActionState` are used accordingly.
- **`src/` root** rather than a repo-root `app/` layout.
- **Local dev without Neon:** `NEON_LOCAL_PROXY=true` routes the neon-http driver through `local-neon-http-proxy` (docker) to a plain local Postgres — the same driver code runs in dev and production. `drizzle-kit push` can't use the proxy; apply generated SQL via `psql` locally.
- **Auth cookie** is `userId.issuedAt.HMAC-SHA256(userId.issuedAt)` via Web Crypto (works on both the edge middleware and the Node server action), max age 1 year, timing-safe comparisons.

## Development Conventions

- TypeScript strict mode; `any` is forbidden — if it seems necessary, the design is wrong.
- Interfaces for all component props.
- One commit per file, Conventional Commits (`chore:` / `feat:` / `fix:` / `docs:`), no co-authorship, no push before manual review.
- Personal gitignored files: `LEARNING_ROADMAP.md` (guided codebase reading order, updated as files are created), `LINKEDIN_POSTS.md` (post ideas), `identidade-visual.html` (design system preview).

## Export & AI contract (v2)

`GET /api/export?from&to` returns a snake_case canonical JSON — `meta` (timezone + `schema_version`), `entities` (full workout-plan history + all config), and `days[]` (per-habit `{done, details, note}`). `DATA_DICTIONARY.md` documents every field; `src/lib/details-schemas.ts` is the source of truth for the `details` shapes. The year-end analysis is: export Jan–Dec → feed the JSON + dictionary to an AI, offline. The `/overview/[date]` Day Audit is the on-screen twin of one export `days[]` entry.

## Out of Scope

Still out: **in-app** AI/insights, LinkedIn generator, notifications, diet, external integrations (e.g. the Duolingo API), multi-user. v2's job is to *capture* a rich, structured dataset; the intelligence layer stays offline (the export). What was MVP-simplified and a bigger version might revisit: routine adherence uses logged blocks (planned counts aren't reconstructed historically); the data dictionary is hand-maintained against the Zod schemas rather than generated.
