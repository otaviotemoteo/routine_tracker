# Development: Personal Tracker

Everything you need to run, extend and deploy the app. For *why* it's built
this way see `ARCHITECTURE.md`. For how it should behave, `UX_PRINCIPLES.md`.
For every stored field, `DATA_DICTIONARY.md`.

---

## Quick Start

```bash
bun install
cp .env.example .env.local   # fill in DATABASE_URL (Neon), AUTH_SECRET
bun run db:push              # applies the schema to Neon via Drizzle
bun run user:create otavio   # an account, repeat per person
bun run dev
```

`bun run db:seed <handle>` is **not** part of a fresh start any more. It seeds
the original seven habits onto one named account, which is only what the owner's
migrated database wants. A new account correctly gets **no** habits: they come
out of that person's own values check-in, and Today shows an empty state
pointing at `/habits` until they do.

### Environment

Only two variables are required — `DATABASE_URL` and `AUTH_SECRET`. Every other
name in `.env.example` is optional, and the app is designed to work with all of
them blank:

| Variable | Effect when blank |
|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | one fewer provider in the rotation |
| `GROQ_API_KEY` | ditto |
| `OPENAI_API_KEY` | ditto |
| *(all three blank)* | the harness reports `unavailable` **before any I/O**, so "Generate habits" is replaced by "Add habits manually" and the whole first run still completes |
| `NEXT_PUBLIC_SENTRY_DSN` | the Sentry SDK is inert; nothing is reported and nothing breaks |
| `SENTRY_AUTH_TOKEN` | the build skips source-map upload and succeeds |
| `NEON_LOCAL_PROXY` | the neon driver talks to Neon rather than a local docker proxy |

Testing the no-key path is worth doing deliberately rather than assuming it: it
is the path every friend hits if a key expires.

### Accounts

There is no sign-up page and no API route that creates an account. These three
scripts are the only way in or out of that state.

```bash
bun run user:create <name>    # new account, no password yet
bun run user:password <name>  # set/reset a password (prompts, never an argument)
bun run db:migrate            # one-shot: single-user database → accounts
```

A new account has no password. The first person to sign in with that name picks
one (8+ characters, a number, a special character) and goes straight into
onboarding. `db:migrate` is only for a database that predates accounts: it
reads `APP_PASSWORD` to create the owner, assigns every existing row to them,
and is safe to re-run. Nothing else reads `APP_PASSWORD`, drop it afterwards.

### Migrations

Each is one transaction over a plain `pg` connection (not the app's neon-http
driver — http has no interactive transactions, and a half-applied migration is
the one outcome these must never leave), every statement guarded so re-running
is a clean no-op.

```bash
bun run db:migrate             # single-user database → accounts
bun run db:migrate:assessment  # the values layer
bun run db:migrate:habits      # habits become per-user  ← run before db:migrate:ai
bun run db:migrate:ai          # ai_runs, ai_pending_requests, login_attempts
```

**Run them against local docker before production, and run each one twice** —
the second run proving a no-op is the whole point of the guards.

`db:migrate:habits` is the only one that touches data that already exists: it
clones the seven shared habits per account, repoints every `daily_checks` row at
the clone, backfills `active_from` from each habit's earliest check so no
adherence denominator moves, then deletes the now-unreferenced shared rows. Its
verification is in `BLOCKED.md`: the owner's existing checks must still resolve,
the seven clones must carry **distinct** `position` values, and each
`active_from` must be on or before that habit's first check.

---

## Stack

| Layer | Technology |
|--------|-----------|
| Framework | Next.js 14+ (App Router) |
| ORM | Drizzle |
| Database | Neon (PostgreSQL) |
| Auth | Middleware + signed cookie (carries the user id) + PBKDF2 |
| Styling | Tailwind |
| Fonts | Fraunces (display), Jost (body), JetBrains Mono (data) |
| Deploy | Vercel |

---

## Database Schema

Everything hangs off `users.id`, `habits` included. `life_domains` is the only
shared table left. Field-by-field semantics are in `DATA_DICTIONARY.md`.

```sql
CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(40) NOT NULL,        -- display: "Sofia"
  handle         VARCHAR(40) NOT NULL UNIQUE, -- lowercase, carries uniqueness
  password_hash  TEXT,                        -- NULL until first sign-in claims it
  first_run_step VARCHAR(30),                 -- NULL = no unfinished first run
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE habits (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  slug       VARCHAR(50) NOT NULL UNIQUE,
  icon       VARCHAR(10),
  optional   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daily_checks (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id),
  habit_id   INT NOT NULL REFERENCES habits(id),
  checked_at DATE NOT NULL,               -- NO default: always passed by the application (São Paulo TZ)
  done       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, habit_id, checked_at)
);

CREATE INDEX idx_checks_date ON daily_checks(checked_at DESC);
```

**Seed:**

```sql
INSERT INTO habits (name, slug, icon, optional) VALUES
  ('Treino',          'treino',          '🏋️', false),
  ('Leitura',         'leitura',         '📖', false),
  ('Sono',            'sono',            '🌙', false),
  ('Rotina',          'rotina',          '⏰', false),
  ('Duolingo',        'duolingo',        '🌍', false),
  ('Espiritualidade', 'espiritualidade', '✝️', false),
  ('Hobby',           'hobby',           '🎸', true);
```

---

## API Routes

```
GET    /api/checks?date=YYYY-MM-DD
       → returns the day's 7 checks (creates them if they don't exist). Without ?date, uses today (São Paulo TZ).

PATCH  /api/checks/:id
       → { done }                → quick toggle (keeps details)
       → { done, details, note } → sheet save (details validated per habit slug by Zod)

GET    /api/checks/week?start=YYYY-MM-DD
       → start must be a Monday. Returns 7 days x 7 habits.

GET    /api/checks/month?month=YYYY-MM
       → all checks for the month + adherence % + streak per habit.

GET    /api/export?from=YYYY-MM-DD&to=YYYY-MM-DD
       → canonical dataset JSON (entities + per-day details). See DATA_DICTIONARY.md.
```

Thin routes: input validation + call to the `src/db/queries.ts` layer. All protected by the auth middleware.

---

## Folder Structure

```
tracker/
├── src/
│   ├── app/
│   │   ├── (app)/               # authed shell: persistent NavBar + onboarding gate
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx         # Today
│   │   │   ├── loading.tsx
│   │   │   └── overview/
│   │   │       ├── page.tsx     # Week | Month toggle
│   │   │       └── [date]/page.tsx   # Day Audit
│   │   │   └── habits/         # list, new, [id], review (the proposals)
│   │   ├── login/              # landing + login (no NavBar)
│   │   ├── onboarding/         # 8-step wizard (page.tsx + actions.ts)
│   │   ├── assessment/         # values check-in → results → directions → areas
│   │   ├── config/            # settings, reuses wizard steps
│   │   ├── api/
│   │   │   ├── checks/{route,[id],week,month}.ts
│   │   │   └── export/route.ts
│   │   ├── layout.tsx          # root: <html>, fonts, lang
│   │   ├── globals.css / error.tsx / global-error.tsx / icon.svg
│   ├── components/
│   │   ├── HabitCard.tsx / HabitSheet.tsx / TodayChecklist.tsx
│   │   ├── sheets/             # per-habit detail-sheet bodies + registry
│   │   ├── onboarding/         # wizard step components + chrome
│   │   ├── WeekGrid / MonthProgress / MonthSummary / PeriodNav / NavBar
│   │   └── landing/            # Hero, HowItWorks, LoginForm, LanguageSelect
│   ├── db/
│   │   ├── schema.ts           # spine + entities + values layer + AI harness
│   │   ├── scope.ts            # branded UserId + habitsFor(): scope by construction
│   │   ├── index.ts / queries.ts / habits.ts / assessment.ts / ai.ts
│   │   ├── login-attempts.ts / first-run.ts / users.ts
│   │   ├── migrate-{users,assessment,habits,ai}.ts / seed{,-assessment}.ts
│   │   └── isolation.test.ts   # cross-user isolation (needs DATABASE_URL)
│   ├── lib/
│   │   ├── utils.ts            # timezone/date helpers, streaks, adherence, pace
│   │   ├── details-schemas.ts  # Zod details per template kind (source of truth)
│   │   ├── i18n.ts + i18n-assessment.ts + get-lang.ts   # bilingual copy
│   │   ├── onboarding{,-prefill}.ts / summaries.ts / describe-details.ts
│   │   ├── diagnose{,.test}.ts # the pure values engine
│   │   ├── templates.ts        # which template kinds may be written, and why
│   │   ├── ai/                 # harness.ts, providers.ts, habit-suggester.ts,
│   │   │                       # suggest-habits.ts
│   │   ├── auth.ts / login-guard.ts / session.ts / icons.ts
│   │   └── sentry-scrub.ts     # what an error report may carry
│   ├── instrumentation.ts      # loads the server/edge Sentry configs
│   ├── instrumentation-client.ts
│   ├── middleware.ts           # cookie-based auth (resolves the user id)
│   └── types/habit.ts
├── sentry.{server,edge}.config.ts
├── identidade-visual.html   # (gitignored) design system preview
├── drizzle.config.ts
├── tailwind.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── next.config.ts
├── .env.example                  # every variable, blank — committed
├── .env.local                    # the filled copy (gitignored)
├── ARCHITECTURE.md               # ships with the repo (how it's built)
├── UX_PRINCIPLES.md              # ships with the repo (how it should behave)
├── DATA_DICTIONARY.md            # ships with the repo (every stored field)
├── SECURITY_REVIEW.md            # ships with the repo (the walk-through + pentest)
├── LEARNING_ROADMAP.md           # (gitignored)
├── LINKEDIN_POSTS.md             # (gitignored)
└── BLOCKED.md                    # (gitignored)
```

---

## Conventions

- TypeScript strict, no `any`, interfaces for all props.
- One commit per file. Conventional Commits (`chore:`, `feat:`, `docs:`). No co-authorship, no push until manual review.
- `.gitignore` includes: `LEARNING_ROADMAP.md`, `LINKEDIN_POSTS.md`, `BLOCKED.md`, `identidade-visual.html`, `.env*`. `ARCHITECTURE.md` ships with the repo on purpose.
- Local development without Neon: `docker` + `local-neon-http-proxy` (set `NEON_LOCAL_PROXY=true` in `.env.local`) lets the same neon-http driver hit a local Postgres.

---

## Timeline (1 week, ~2h/day)

| Day | Deliverable |
|-----|---------|
| Mon | Setup: Next.js + Drizzle + Neon. Schema. Seed. Date helpers with TZ. |
| Tue | Auth (middleware + login). Day API + toggle. "Today" screen functional. |
| Wed | Week API. "Week" screen with grid. |
| Thu | Month API (% + streak). "Month" screen. |
| Fri | Deploy to Vercel. Test on phone. Visual adjustments. |
