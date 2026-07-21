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
- `daily_checks` holds one row per habit per day. Rows are lazily created: the first GET of a given day inserts the 7 checks with `done = false` inside a transaction, relying on the UNIQUE constraint for idempotency.
- The `optional` flag drives presentation and scoring: optional habits render with a dashed border and are excluded from the daily progress bar and from best/worst weekly summaries.

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
5. **Optimistic toggling.** The card flips instantly on tap and rolls back if the `PATCH` fails.

## API Surface

```
GET    /api/checks?date=YYYY-MM-DD    today's 7 checks (lazily created)
PATCH  /api/checks/:id                { done: boolean } toggle
GET    /api/checks/week?start=...     7 days × 7 habits (start must be Monday)
GET    /api/checks/month?month=...    month's checks + adherence % + streak per habit
```

All routes sit behind the auth middleware. Handlers return proper status codes with JSON error bodies; every handler wraps its work in try/catch.

## Authentication

Deliberately minimal for a single user:

- `middleware.ts` protects everything except `/login` and static assets by validating an httpOnly cookie signed with `AUTH_SECRET`.
- `/login` compares the submitted password against `APP_PASSWORD` (env var) and sets the cookie.
- No Auth.js, no user table, no sessions store. If the app ever goes multi-user, this swaps out for Auth.js without touching the data layer.

## Frontend Architecture

- **Server Components by default.** Pages fetch data on the server; `"use client"` appears only in `HabitCard` (optimistic toggle) and navigation controls.
- **Screens:** `/` (Today: 7 cards + progress bar), `/semana` (GitHub-contributions-style 7×7 grid with prev/next week), `/mes` (per-habit adherence bar + streak with prev/next month).
- **Design system "Canteiro":** cream paper background, near-black forest-green ink, clover-green accent, hard offset shadows (`4px 4px 0`, never blurred), 2px borders, small-caps serif display type. Tokens: `papel #F7F3E8`, `mata #17281C`, `trevo #3D9B4F`, `broto #E3EFE0`, `palha #D9A03F` (streaks only), `cinza-palha #DCD9CC`. Full living reference in `identidade-visual.html` (gitignored).
- **Mobile-first.** Primary usage is on the phone; touch targets ≥ 44px, visible focus states, `prefers-reduced-motion` respected.

## Quality & UX Process

Development runs as an autonomous loop (see `CLAUDE.md`): assess state → build phase → verify (`tsc --noEmit`, lint, dev server) → **UI/UX review** → commit → document → repeat.

Every phase that touches the interface is audited against two skill checklists — `ui-ux-pro-max-skill` (GitHub) and the local `revenue-centric-design` skill — covering visual hierarchy, toggle affordance, empty/loading/error states, mobile legibility, and the first-run experience (login → empty Today → first check). "It works" is not "it's good"; the loop iterates until the checklist passes.

The loop stops only when every phase is complete and audited. What remains is the **human block**: creating the Neon database, filling `.env.local`, running migrations/seed, deploying to Vercel, and end-to-end testing on desktop and mobile.

## Development Conventions

- TypeScript strict mode; `any` is forbidden — if it seems necessary, the design is wrong.
- Interfaces for all component props.
- One commit per file, Conventional Commits (`chore:` / `feat:` / `fix:` / `docs:`), no co-authorship, no push before manual review.
- Personal gitignored files: `CLAUDE.md` (autonomous execution prompt), `LEARNING_ROADMAP.md` (guided codebase reading order, updated as files are created), `LINKEDIN_POSTS.md` (post ideas), `identidade-visual.html` (design system preview).

## Out of Scope (MVP)

No AI, no insights, no LinkedIn generator, no notifications, no diet tracking, no external integrations, no multi-user. All of that belongs to the future "personal hub" and is only reconsidered after 2–3 weeks of real daily usage. The MVP is daily check-in + visualization. Period.
