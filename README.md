# Personal Tracker

Personal web app for daily habit check-ins with weekly and monthly visualization.

**One sentence:** I open the app, mark what I did today, and see my consistency over the week and the month.

---

## MVP Scope

**In:**

- 7 habits (6 required + 1 optional): 🏋️ Workout, 📖 Reading, 🌙 Sleep, ⏰ Routine, 🌍 Duolingo, ✝️ Spirituality, 🎸 Hobby (optional)
- **Today** screen (`/`): 7 cards + progress bar for the required habits. Picking the day is a draft; one confirm button saves everything and the screen locks until "edit tasks"
- Bilingual interface (English default, Portuguese), switchable from any screen
- **Week** screen (`/semana`): GitHub-contributions-style grid (7 days x 7 habits), navigation between weeks
- **Month** screen (`/mes`): adherence % per habit + current streak, navigation between months
- Simple single-user auth (password via env var)

**Out:** AI, insights, LinkedIn posts, projects, notifications, diet, external integrations, multi-user. All of that is a future hub. The MVP is daily check-in + visualization. Period.

---

## Stack

| Layer | Technology |
|--------|-----------|
| Framework | Next.js 14+ (App Router) |
| ORM | Drizzle |
| Database | Neon (PostgreSQL) |
| Auth | Middleware + `APP_PASSWORD` (env) + signed cookie |
| Styling | Tailwind |
| Fonts | Fraunces (display), Jost (body), JetBrains Mono (data) |
| Deploy | Vercel |

---

## Consolidated Decisions

Business rules that apply to the entire codebase. Do not reinterpret.

1. **Timezone is always `America/Sao_Paulo`.** A check's date NEVER comes from the database's `CURRENT_DATE` (Neon/Vercel run in UTC and the day would roll over at 9pm Brasília time). Every "today" date is calculated in the application code with an explicit timezone and passed as a parameter into queries. Single helper in `src/lib/utils.ts` (`todayInSaoPaulo(): string` in `YYYY-MM-DD` format) used everywhere.
2. **Auth is hardcoded on purpose.** Next.js middleware checks the cookie; the `/login` page compares against `APP_PASSWORD` from env and sets an httpOnly cookie signed with `AUTH_SECRET`. No Auth.js in the MVP.
3. **Week starts on Monday** (Mon–Sun), across all screens and calculations.
4. **A streak doesn't break because today hasn't been marked yet.** Streak = consecutive days with the habit done counting backward from yesterday; add +1 if today is already done.
5. **Month adherence %** = days done ÷ days elapsed in the month (from day 1 through today, inclusive), not total days in the month. Past months use the month's total day count.
6. **Hobby is optional:** it appears on every screen with a distinct visual (dashed border, "optional" label), but doesn't count toward the day's progress bar nor the week's best/worst.
7. **Toggle is optimistic UI:** the card changes instantly on click and reverts if the PATCH fails.
8. **HTTP routes in `app/api`, organized like DevTrack.** Routes are thin: they validate input and call the query layer (`src/db/queries.ts`), which concentrates all database access. No loose SQL/Drizzle inside route handlers or components.
9. **Organization follows DevTrack.** Folder structure, naming, layers (route → query → schema), and best practices replicate the conventions adopted in `/home/otavio/Desktop/projetos/pessoal/devtrack`. Where this README conflicts with DevTrack, this README wins (the tracker is intentionally simpler).

---

## Design System — "Canteiro"

Identity: cream paper, deep-green ink, offset hard shadows, thick-bordered cards. Retro-editorial aesthetic in green.

### Palette

In code (tailwind.config.ts) the tokens use English color names; the mapping is fixed:

| Token | Tailwind name | Hex | Use |
|-------|---------------|-----|-----|
| `--papel` | `cream` | `#F7F3E8` | Overall background |
| `--mata` | `forest` | `#17281C` | Text, borders, hard shadows |
| `--trevo` | `clover` | `#3D9B4F` | Accent: primary buttons, completed checks, done cells |
| `--broto` | `mint` | `#E3EFE0` | Soft fills: hover, marked card, section tint |
| `--palha` | `straw` | `#D9A03F` | Exclusive to streaks and achievement highlights |
| `--cinza-palha` | `sand` | `#DCD9CC` | Empty cells, unfilled bars, muted text together with `forest` opacity |

### Typography

- **Fraunces** (700/900) — titles and headings, with `font-variant-caps: small-caps` and wide letter-spacing on screen titles ("Today", "Week", "Month")
- **Jost** (400/500/600) — body, labels, buttons
- **JetBrains Mono** (500/700) — numbers: percentages, counters (4/6), streaks

### Signature Components

- **Hard shadow:** `box-shadow: 4px 4px 0 var(--mata)` on cards and buttons (6px on button hover, with a -2px translate). No blur, ever.
- **Borders:** `2px solid var(--mata)`, 10–12px radius on cards, pill buttons (full radius).
- **Completed habit card:** `--broto` fill, check in `--trevo`.
- **Hobby card:** `2px dashed` border, small "optional" label.
- **Week grid:** square cells with 4px radius; done in `--trevo`, empty in `--cinza-palha`, both with a thin border of `--mata` at 15% opacity.
- **Eyebrow:** small caps label with a left dash (like the reference's "— RESERVATIONS"), in `--trevo`.

Full preview in `docs/identidade-visual.html` (historical reference, gitignored). The UI never renders emoji: habit icons are lucide-react SVGs mapped by slug in `src/lib/icons.ts` (the emoji in the database `icon` column is legacy seed data, unused by the interface).

---

## Database Schema

Two tables.

```sql
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
  habit_id   INT NOT NULL REFERENCES habits(id),
  checked_at DATE NOT NULL,               -- NO default: always passed by the application (São Paulo TZ)
  done       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, checked_at)
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

PATCH  /api/checks
       → body: { updates: [{ id, done }] }. Saves the whole day in one request (used by the "Today" screen).

PATCH  /api/checks/:id
       → body: { done: boolean }. Toggles a single check.

GET    /api/checks/week?start=YYYY-MM-DD
       → start must be a Monday. Returns 7 days x 7 habits.

GET    /api/checks/month?month=YYYY-MM
       → all checks for the month + adherence % + streak per habit.
```

Thin routes: input validation + call to the `src/db/queries.ts` layer. All protected by the auth middleware.

---

## Folder Structure

```
tracker/
├── src/
│   ├── app/
│   │   ├── page.tsx              # "Today" screen
│   │   ├── login/
│   │   │   ├── page.tsx          # Landing + password form
│   │   │   └── actions.ts        # Login server action
│   │   ├── semana/page.tsx
│   │   ├── mes/page.tsx
│   │   ├── api/checks/
│   │   │   ├── route.ts          # GET (day)
│   │   │   ├── [id]/route.ts     # PATCH (toggle)
│   │   │   ├── week/route.ts
│   │   │   └── month/route.ts
│   │   ├── layout.tsx
│   │   ├── loading.tsx           # skeleton
│   │   ├── error.tsx             # error boundary
│   │   ├── globals.css
│   │   └── icon.svg
│   ├── components/
│   │   ├── HabitCard.tsx         # "use client" — optimistic toggle
│   │   ├── TodayChecklist.tsx    # owns the day state + progress bar
│   │   ├── WeekGrid.tsx
│   │   ├── MonthProgress.tsx
│   │   ├── PeriodNav.tsx         # shared prev/next navigation
│   │   ├── NavBar.tsx
│   │   └── landing/              # Hero, HowItWorks, LoginForm
│   ├── db/
│   │   ├── schema.ts
│   │   ├── index.ts
│   │   ├── queries.ts            # All database reads/writes go through here
│   │   └── seed.ts
│   ├── lib/
│   │   ├── utils.ts              # todayInSaoPaulo(), weekStartMonday(), streaks, %
│   │   ├── auth.ts               # HMAC cookie signing (Web Crypto)
│   │   └── icons.ts              # habit slug → lucide icon
│   ├── middleware.ts             # cookie-based auth
│   └── types/habit.ts
├── docs/identidade-visual.html   # (gitignored) design system preview
├── drizzle.config.ts
├── tailwind.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── next.config.ts
├── .env.local                    # DATABASE_URL, APP_PASSWORD, AUTH_SECRET
├── ARCHITECTURE.md               # ships with the repo
├── CLAUDE.md                     # (gitignored)
├── LEARNING_ROADMAP.md           # (gitignored)
├── LINKEDIN_POSTS.md             # (gitignored)
└── BLOCKED.md                    # (gitignored)
```

---

## Quick Start

```bash
bun install
cp .env.example .env.local   # fill in DATABASE_URL (Neon), APP_PASSWORD, AUTH_SECRET
bun run db:push              # applies the schema to Neon via Drizzle
bun run db:seed              # populates the 7 habits
bun run dev
```

---

## Timeline (1 week, ~2h/day)

| Day | Deliverable |
|-----|---------|
| Mon | Setup: Next.js + Drizzle + Neon. Schema. Seed. Date helpers with TZ. |
| Tue | Auth (middleware + login). Day API + toggle. "Today" screen functional. |
| Wed | Week API. "Week" screen with grid. |
| Thu | Month API (% + streak). "Month" screen. |
| Fri | Deploy to Vercel. Test on phone. Visual adjustments. |

---

## Conventions

- TypeScript strict, no `any`, interfaces for all props.
- One commit per file. Conventional Commits (`chore:`, `feat:`, `docs:`). No co-authorship, no push until manual review.
- `.gitignore` includes: `LEARNING_ROADMAP.md`, `LINKEDIN_POSTS.md`, `CLAUDE.md`, `BLOCKED.md`, `identidade-visual.html`, `.env*`. `ARCHITECTURE.md` ships with the repo on purpose.
- Local development without Neon: `docker` + `local-neon-http-proxy` (set `NEON_LOCAL_PROXY=true` in `.env.local`) lets the same neon-http driver hit a local Postgres.
