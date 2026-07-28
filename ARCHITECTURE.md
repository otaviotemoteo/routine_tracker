# Architecture — Personal Habit Tracker

A single-user web app for daily habit check-ins with weekly and monthly consistency views.

**One sentence:** open the app, check off what I did today, see my consistency over the week and the month.

This document explains *how* the system is built and *why*. For scope, screens and the day-by-day plan, see `README.md`.

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
│  middleware.ts ── auth gate (signed cookie)          │
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
│  tables: habits, daily_checks                        │
└─────────────────────────────────────────────────────┘
```

The project deliberately mirrors the organization of **DevTrack** (`/home/otavio/Desktop/projetos/pessoal/devtrack`): same folder conventions, same strict layering, same naming style. The tracker is DevTrack's simpler sibling — same house, same rules. Where this documentation conflicts with DevTrack conventions, this documentation wins, because the tracker is intentionally simpler.

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 14+ (App Router) | Already mastered from DevTrack; RSC-first |
| ORM | Drizzle | Type-safe, lightweight, already in use |
| Database | Neon (PostgreSQL) | Serverless, zero config, already in use |
| Auth | Custom middleware + env password | Single user; anything more is overkill |
| Styling | Tailwind | Tokens for the "Canteiro" design system |
| Fonts | Fraunces / Jost / JetBrains Mono | Display / body / numeric data |
| Deploy | Vercel | Zero config for Next.js |

## Layering (the core rule)

Three strict layers, dependencies pointing downward only:

1. **Route handlers** (`app/api/checks/**`) — thin. They parse and validate input, call one function from the query layer, and shape the HTTP response (status codes, JSON errors). No Drizzle, no SQL, no business math here.
2. **Query layer** (`src/db/queries.ts`) — the only file that touches Drizzle. Concentrates every read and write: fetch-or-create today's checks, toggle a check, week window, month stats. Business calculations (streak, adherence %) are delegated to pure helpers.
3. **Schema** (`src/db/schema.ts`) — Drizzle table definitions, mirrored by TypeScript interfaces in `src/types/habit.ts`.

Pure helpers live in `src/lib/utils.ts` (date/timezone handling, streak and adherence math). They take plain data in and return plain data out — no I/O — which keeps the tricky logic trivially testable.

Server Components fetch through the API routes' underlying query functions; client components ("islands") exist only where interactivity demands it (`HabitCard` toggle, week/month navigation).

## Data Model

Two tables. That's the whole model.

```
habits                          daily_checks
──────                          ────────────
id          SERIAL PK           id          SERIAL PK
name        VARCHAR(50)         habit_id    FK → habits.id
slug        VARCHAR(50) UNIQUE  checked_at  DATE  (no DB default!)
icon        VARCHAR(10)         done        BOOLEAN default false
optional    BOOLEAN             created_at  TIMESTAMPTZ
created_at  TIMESTAMPTZ         updated_at  TIMESTAMPTZ

                                UNIQUE(habit_id, checked_at)
                                INDEX on checked_at DESC
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

`/onboarding?step=…` is an 8-step wizard; each step is a form whose **server action upserts its entity table and redirects to the next step** (via a hidden `next` field), so abandoning mid-way loses nothing and every step is skippable. The dynamic steps are client components that serialize their rows into one hidden JSON field. The `(app)` layout **gates** the app: with nothing configured (`isConfigured()`) and no `onboarded` cookie it redirects to the wizard; finishing sets the cookie so an intentional skip isn't nagged (a navigation hint, not a data flag). `/config` reuses the exact same step components with `next="/config"` — same actions, saving in place instead of advancing. Prefill loaders are shared in `src/lib/onboarding-prefill.ts`.

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
5. **Per-habit sheets (v2).** Tapping a card opens a detail sheet whose Save writes that habit's `details` (validated) **and** flips `done` in one `PATCH /api/checks/:id`; the corner box is a quick-toggle (`done` only, details preserved) for rushed days. The card then shows a one-line badge (e.g. "+23 p", "7.5 h"). The spine never depends on details being filled. (This replaced an interim whole-day "confirm" flow.)

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

## Authentication

Deliberately minimal for a single user:

- `middleware.ts` protects everything except `/login` and static assets by validating an httpOnly cookie signed with `AUTH_SECRET`.
- `/login` compares the submitted password against `APP_PASSWORD` (env var) and sets the cookie.
- No Auth.js, no user table, no sessions store — accounts don't exist in the database at all; the env password is the only credential. If the app ever goes multi-user, this swaps out for Auth.js without touching the data layer.
- **Login rate limiting** (`src/lib/rate-limit.ts`): 5 failed passwords per IP per 15-minute sliding window blocks further attempts (even with the right password) until the window expires; success clears the counter. It's in-memory, so a serverless cold start resets it — acceptable for the only unauthenticated surface of a single-user app; the durable upgrade path is Upstash or Vercel WAF rules.

## Frontend Architecture

- **Server Components by default.** Pages fetch data on the server; `"use client"` appears only in `HabitCard` (optimistic toggle) and navigation controls.
- **Screens:** `/` (Today: 7 cards + progress bar), `/semana` (GitHub-contributions-style 7×7 grid with prev/next week), `/mes` (per-habit adherence bar + streak with prev/next month).
- **Design system "Canteiro":** cream paper background, near-black forest-green ink, clover-green accent, hard offset shadows (`4px 4px 0`, never blurred), 2px borders, small-caps serif display type. In code the Tailwind tokens use English names (per Otávio's preference): `cream #F7F3E8` (papel), `forest #17281C` (mata), `clover #3D9B4F` (trevo), `mint #E3EFE0` (broto), `straw #D9A03F` (palha, streaks only), `sand #DCD9CC` (cinza-palha). Shared utilities `.display-title` and `.eyebrow` live in `globals.css`; hard shadows are the `shadow-hard{,-lg,-sm}` scale. Historical reference in `docs/identidade-visual.html` (gitignored).
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

Development runs as an autonomous loop (see `CLAUDE.md`): assess state → build phase → verify (`tsc --noEmit`, lint, dev server) → **UI/UX review** → commit → document → repeat.

Every phase that touches the interface is audited against two skill checklists — `ui-ux-pro-max-skill` (GitHub) and the local `revenue-centric-design` skill — covering visual hierarchy, toggle affordance, empty/loading/error states, mobile legibility, and the first-run experience (login → empty Today → first check). "It works" is not "it's good"; the loop iterates until the checklist passes.

The loop stops only when every phase is complete and audited. What remains is the **human block**: creating the Neon database, filling `.env.local`, running migrations/seed, deploying to Vercel, and end-to-end testing on desktop and mobile.

## Deviations & Notable Choices

- **Tailwind v3 (not v4 like DevTrack)** so the design tokens live in `tailwind.config.ts` exactly as the project contract asks; DevTrack's CSS-first v4 tokens would scatter them into `globals.css`.
- **Next 15 / React 19** ("14+" per README): async `searchParams`/`params` and `useActionState` are used accordingly.
- **`src/` root** (README) instead of DevTrack's repo-root `app/` layout.
- **Local dev without Neon:** `NEON_LOCAL_PROXY=true` routes the neon-http driver through `local-neon-http-proxy` (docker) to a plain local Postgres — the same driver code runs in dev and production. `drizzle-kit push` can't use the proxy; apply generated SQL via `psql` locally.
- **Auth cookie** is `issuedAt.HMAC-SHA256(issuedAt)` via Web Crypto (works on both the edge middleware and the Node server action), max age 1 year, timing-safe comparisons.

## Development Conventions

- TypeScript strict mode; `any` is forbidden — if it seems necessary, the design is wrong.
- Interfaces for all component props.
- One commit per file, Conventional Commits (`chore:` / `feat:` / `fix:` / `docs:`), no co-authorship, no push before manual review.
- Personal gitignored files: `CLAUDE.md` (autonomous execution prompt), `LEARNING_ROADMAP.md` (guided codebase reading order, updated as files are created), `LINKEDIN_POSTS.md` (post ideas), `identidade-visual.html` (design system preview).

## Export & AI contract (v2)

`GET /api/export?from&to` returns a snake_case canonical JSON — `meta` (timezone + `schema_version`), `entities` (full workout-plan history + all config), and `days[]` (per-habit `{done, details, note}`). `DATA_DICTIONARY.md` documents every field; `src/lib/details-schemas.ts` is the source of truth for the `details` shapes. The year-end analysis is: export Jan–Dec → feed the JSON + dictionary to an AI, offline. The `/overview/[date]` Day Audit is the on-screen twin of one export `days[]` entry.

## Out of Scope

Still out: **in-app** AI/insights, LinkedIn generator, notifications, diet, external integrations (e.g. the Duolingo API), multi-user. v2's job is to *capture* a rich, structured dataset; the intelligence layer stays offline (the export). What was MVP-simplified and a bigger version might revisit: routine adherence uses logged blocks (planned counts aren't reconstructed historically); the data dictionary is hand-maintained against the Zod schemas rather than generated.
