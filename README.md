# Personal Tracker

Personal web app for daily habit check-ins with weekly/monthly visualization and a rich, auditable per-day dataset.

**One sentence:** I open the app, mark what I did today (down to pages read and lessons done), and see my consistency — and any single day — over the week and the month.

---

## Scope

**In:**

- 7 habits (6 required + 1 optional): 🏋️ Workout, 📖 Reading, 🌙 Sleep, ⏰ Routine, 🌍 Duolingo, ✝️ Spirituality, 🎸 Hobby (optional)
- **Today** screen (`/`): a status board — progress bar (required habits) + one card per habit reporting where it stands: done (with what it logged, e.g. "2/2", "+23 p") or what today expects of it ("Chest + triceps", "Dune · page 100 of 412", "Target 23:00 – 06:30"). A single **"Complete daily"** button opens the guided check-in at `/day` — one habit per step, prefilled from your goals ("Did you do Workout today? · Chest + triceps · Bench press 4×8"), saving details + done per step, with skip.
- **Overview** screen (`/overview`): a Week | Month toggle (absorbs the old `/semana`, `/mes`). Week = contributions grid with tappable cells; Month = adherence % + streaks **plus** rich summaries (avg sleep, pages read, workout %, lessons). Cells link to a **Day Audit** (`/overview/[date]`) — everything logged that day, human-readable. Below the chart, an **Activities** section shows your configured setup (with the reading pace you need to hit your goal) and links straight into editing it.
- **Onboarding** (`/onboarding`): an 8-step wizard configuring the workout plan, reading list/goal, sleep window, routine blocks, languages and spiritual practices. Editable later under `/config`.
- **Rich data model** (v2): a binary spine (`done`) + JSONB `details` validated by Zod + normalized entity tables. See `DATA_DICTIONARY.md`.
- **Export** (`GET /api/export?from&to`): the canonical dataset JSON for a future year-end AI analysis.
- Bilingual interface (English default, Portuguese), switchable from any screen.
- Simple single-user auth (password via env var, login rate-limited).

**Out:** AI insights in-app, LinkedIn posts, notifications, diet, external integrations (e.g. the Duolingo API), multi-user. The app captures the dataset; the year-end analysis is done by feeding the export + `DATA_DICTIONARY.md` to an AI offline.

See `ARCHITECTURE.md` for how it's built, `UX_PRINCIPLES.md` for how it should behave, and `DATA_DICTIONARY.md` for every stored field.

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
| `--palha` | `straw` | `#D9A03F` | Streaks, achievement highlights, and the "pending" state (a `straw/30` chip on Today's cards) |
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
│   ├── middleware.ts           # cookie-based auth
│   └── types/habit.ts
├── docs/identidade-visual.html   # (gitignored) design system preview
├── drizzle.config.ts
├── tailwind.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── next.config.ts
├── .env.local                    # DATABASE_URL, APP_PASSWORD, AUTH_SECRET
├── ARCHITECTURE.md               # ships with the repo (how it's built)
├── UX_PRINCIPLES.md              # ships with the repo (how it should behave)
├── DATA_DICTIONARY.md            # ships with the repo (every stored field)
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
- `.gitignore` includes: `LEARNING_ROADMAP.md`, `LINKEDIN_POSTS.md`, `BLOCKED.md`, `identidade-visual.html`, `.env*`. `ARCHITECTURE.md` ships with the repo on purpose.
- Local development without Neon: `docker` + `local-neon-http-proxy` (set `NEON_LOCAL_PROXY=true` in `.env.local`) lets the same neon-http driver hit a local Postgres.
