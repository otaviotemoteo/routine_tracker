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

`habits` is a shared catalogue; everything else belongs to one account through
`user_id` (see "Data ownership").

```
users                 habits                daily_checks
─────                 ──────                ────────────
id      SERIAL PK     id      SERIAL PK     id          SERIAL PK
name    VARCHAR(40)   name    VARCHAR(50)   user_id     FK → users.id
handle  VARCHAR(40)   slug    VARCHAR(50)   habit_id    FK → habits.id
        UNIQUE                UNIQUE        checked_at  DATE (no DB default!)
password_hash TEXT    icon    VARCHAR(10)   done        BOOLEAN default false
        NULL = unclaimed
                      optional BOOLEAN      details     JSONB (Tier 2)
created_at TIMESTAMPTZ                      note        TEXT

                          UNIQUE(user_id, habit_id, checked_at)
                          INDEX on (user_id, checked_at DESC)
```

- `habits` is seeded once with 7 rows (6 required + 1 optional "Hobby") and is effectively static in the MVP.
- `daily_checks` holds one row per habit per day. Rows are lazily created: the first GET of a given day inserts the 7 checks with `done = false` as a single multi-row `INSERT … ON CONFLICT DO NOTHING` — one atomic statement (the neon-http driver has no interactive transactions), with the UNIQUE constraint guaranteeing idempotency under concurrent first-loads.
- The `optional` flag drives presentation and scoring: optional habits render with a dashed border and are excluded from the daily progress bar and from best/worst weekly summaries.

## v2 — Rich tracking (three tiers)

v2 turns the binary spine into an auditable dataset without disturbing it. Three tiers, additive:

1. **Spine (Tier 1):** `daily_checks.done` — unchanged. The grid, streaks and adherence % read only this and never regress.
2. **Daily details (Tier 2):** `daily_checks.details JSONB` + `note TEXT`. `details` is habit-specific and **validated by a Zod schema on every write** (`src/lib/details-schemas.ts`, one per slug, `.strict()`). `NULL` details = "done without details" (v1 rows and quick-toggle days) — valid forever.
3. **Entities (Tier 3):** normalized tables for things with a lifecycle beyond a day — `workout_plans`(+`_days`), `reading_goals`, `books`, `routine_blocks`, `spiritual_practices`, `languages`. `details` references them by id/slug. **Workout plans are immutable & versioned** (edit = insert `version+1`, flip `active`); the change log is `ORDER BY version`, no audit table.

`src/lib/details-schemas.ts` is the single source of truth: it validates writes, generates the TS types (`z.infer`), and feeds `DATA_DICTIONARY.md` via each field's `.describe()`. All Tier-3 access stays in `src/db/queries.ts` like the spine. Derived metrics (reading pace, routine/plan adherence) are pure helpers in `src/lib/utils.ts` — computed, never stored.

## Route groups & persistent shell (v2)

The authenticated app lives in an `app/(app)/` route group whose layout renders the `NavBar` **once** — it persists across navigations instead of remounting per page (the real cause of the old "reload" flash; all navigation was already `next/link`). `/login` and `/onboarding` sit outside the group and get no NavBar. `/semana` and `/mes` are permanent redirects into the `/overview` Week|Month toggle (`next.config.ts`).

## Onboarding (v2)

`/onboarding?step=…` is an 8-step wizard; each step is a form whose **server action upserts its entity table and redirects to the next step** (via a hidden `next` field), so abandoning mid-way loses nothing and every step is skippable. The dynamic steps are client components that serialize their rows into one hidden JSON field. The `(app)` layout **gates** the app: with nothing configured (`isConfigured()`) and no `onboarded` cookie it redirects to the wizard; finishing sets the cookie so an intentional skip isn't nagged (a navigation hint, not a data flag). `/config` reuses the exact same step components with `next="/config"` — same actions, saving in place instead of advancing. Prefill loaders are shared in `src/lib/onboarding-prefill.ts`, and `src/lib/setup-summary.ts` builds the one summary rendered by the wizard's Review step, the `/config` index and the Overview **Activities** section (below the week/month chart) — so the three never drift. Because `/onboarding` and `/config` sit outside the `(app)` group (no NavBar), each renders its own `LanguageSelect`.

Books are reconciled **by id** (`saveReadingList`): existing rows update, new ones insert, and only removed-and-untouched books are deleted — a book with progress or a done/abandoned status is never deleted, since past `details.book_id` references it.

## The values layer (M1)

The tracker records what you did. The values layer records **what you said mattered**, so that the two can be compared. It is additive: it shares only the `users` table with everything above, and nothing in the tracker reads it.

**Shape.** `life_domains` (12 seeded rows, global like `habits`) → `cycles` (a half-year, derived from the date, no UI) → `assessments` → `assessment_ratings` (six 1–10 answers per domain) and `direction_narratives` (one written direction per priority domain). No display text is stored: names, descriptions, boundary notes and writing prompts live in `src/lib/i18n-assessment.ts` keyed by slug, because the app is bilingual and `habits.name` already shows what it costs to bake one language into a table.

**Draft, then sealed.** This is the one place where "append-only" and "every step saves on advance" appear to collide. They don't: an assessment is **mutable while `completed_at IS NULL` and immutable forever once it is set**, because a draft isn't the record yet. Since neon-http has no interactive transactions, each guard is a predicate inside a single statement rather than a read-then-write:

- a rating write is an `INSERT … SELECT … FROM assessments WHERE id = ? AND user_id = ? AND completed_at IS NULL … ON CONFLICT DO UPDATE`, so ownership and the seal are checked in the same round trip;
- a partial unique index (`assessments (user_id) WHERE completed_at IS NULL`) makes two open drafts unrepresentable;
- sealing only fires when all twelve ratings are present, and a double-tapped Continue returns no row, which means "already sealed" and not an error.

**The engine is pure.** `src/lib/diagnose.ts` takes a grid and returns patterns, distances and a ranking with no I/O, so it is tested directly (`bun test`). It ranks by the **raw** value-action gap, not a z-score: within one assessment, subtracting a column mean cannot change the ordering, and standardising the two columns separately would silently weight them by their own spread — importance answers cluster, so its deviation is small, and the ranking would stop being about action at all. Z-scores earn their place as `gapSpread()`, which tells the results screen when the domains are too bunched for the cut at five to mean much.

**One thing is stored that could be computed.** `assessments.priority_domains` freezes the top-five cut at sealing time. Recomputing it on read would let a later change to `THRESHOLDS` rewrite which domains a past cycle prioritised, while its direction narratives sat attached to domains no longer on the list, which is history rewritten by a deploy.

**Focus mode.** `/assessment` sits outside the `(app)` group, so there is no NavBar to wander off through mid-grid and it renders its own `LanguageSelect`, exactly as `/onboarding` and `/config` do. `src/lib/assessment.ts` is the third instance of the wizard mechanic (after `onboarding.ts` and `daily.ts`); the one thing it adds is a ceiling — `resolveAssessmentStep` clamps a requested step to the first unanswered domain, so backwards is free, forwards is impossible, and the results screen cannot be reached before the grid is finished. That is arithmetic rather than a hidden button, because a UI convention is one URL edit away from being ignored.

**Scripts.** `bun run db:migrate:assessment` creates the layer (idempotent, one transaction, `pg` over TCP). `bun run assessment:seed <file.json>` backfills a grid answered on paper, through the same Zod schema and the same `prioritize()` the app uses, and refuses to overwrite a sealed assessment. In that file `ratings` is optional: a file carrying only `directions` writes the written half alone, which is what you want when the numbers will be answered in the app but the reflections already exist on paper. Seed them first and the writing step opens with your own words in it, to review rather than retype. It never prefills a rating.

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
- **Login rate limiting** (`src/lib/rate-limit.ts`): 5 failed attempts per IP
  per 15-minute sliding window blocks further attempts (even with the right
  password) until the window expires; success clears the counter. It's
  in-memory, so a serverless cold start resets it; the durable upgrade path is
  Upstash or Vercel WAF rules. It also covers the name step, which is what
  makes guessing an unclaimed name impractical.

## Data ownership

Every per-user table carries `user_id`; `habits` does not, because the seven
habits are a shared catalogue (when activities become user-defined, it grows
one like the rest). `workout_plan_days` reaches its owner through `plan_id`.

Two rules hold everywhere in `src/db/queries.ts`:

1. **Every function takes `userId` as its first argument**, resolved once per
   request by `requireUserId()` (pages/actions) or `getUserId()` (API routes,
   which answer 401 rather than redirect) — `src/lib/session.ts`.
2. **Every id-addressed write filters on the user too**
   (`WHERE id = ? AND user_id = ?`), so a check or book id belonging to
   somebody else matches no row instead of being mutated. Ownership is never
   inferred from the id alone.

Uniqueness that used to be global is per-account:
`daily_checks(user_id, habit_id, checked_at)`, `reading_goals(user_id, year)`,
`spiritual_practices(user_id, slug)`, `languages(user_id, slug)`.

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
