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
bun run db:seed              # populates the 7 shared habits
bun run user:create otavio   # an account, repeat per person
bun run dev
```

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

`habits` is shared by every account. Everything else hangs off `users.id`.

```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(40) NOT NULL,        -- display: "Sofia"
  handle        VARCHAR(40) NOT NULL UNIQUE, -- lowercase, carries uniqueness
  password_hash TEXT,                        -- NULL until first sign-in claims it
  created_at    TIMESTAMPTZ DEFAULT NOW()
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
│   │   ├── login/              # landing + login (no NavBar)
│   │   ├── onboarding/         # 8-step wizard (page.tsx + actions.ts)
│   │   ├── config/            # settings, reuses wizard steps
│   │   ├── api/
│   │   │   ├── checks/{route,[id],week,month}.ts
│   │   │   └── export/route.ts
│   │   ├── layout.tsx          # root: <html>, fonts, lang
│   │   ├── globals.css / error.tsx / icon.svg
│   ├── components/
│   │   ├── HabitCard.tsx / HabitSheet.tsx / TodayChecklist.tsx
│   │   ├── sheets/             # per-habit detail-sheet bodies + registry
│   │   ├── onboarding/         # wizard step components + chrome
│   │   ├── WeekGrid / MonthProgress / MonthSummary / PeriodNav / NavBar
│   │   └── landing/            # Hero, HowItWorks, LoginForm, LanguageSelect
│   ├── db/
│   │   ├── schema.ts           # Tier 1 spine + Tier 3 entities
│   │   ├── index.ts / queries.ts / seed.ts
│   ├── lib/
│   │   ├── utils.ts            # timezone/date helpers, streaks, adherence, pace
│   │   ├── details-schemas.ts  # Zod per-habit details (source of truth)
│   │   ├── i18n.ts + get-lang.ts   # bilingual copy
│   │   ├── onboarding{,-prefill}.ts / summaries.ts / describe-details.ts
│   │   ├── auth.ts / rate-limit.ts / icons.ts
│   ├── middleware.ts           # cookie-based auth (resolves the user id)
│   └── types/habit.ts
├── identidade-visual.html   # (gitignored) design system preview
├── drizzle.config.ts
├── tailwind.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── next.config.ts
├── .env.local                    # DATABASE_URL, AUTH_SECRET
├── ARCHITECTURE.md               # ships with the repo (how it's built)
├── UX_PRINCIPLES.md              # ships with the repo (how it should behave)
├── DATA_DICTIONARY.md            # ships with the repo (every stored field)
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
