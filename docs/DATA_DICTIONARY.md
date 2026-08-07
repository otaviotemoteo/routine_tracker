# Data Dictionary — Personal Tracker (schema v2)

The canonical description of every stored field, so the dataset is understandable
by a human and by an AI analyzing it at year's end. If a field isn't here, it
doesn't exist.

**Source of truth for `details` shapes:** `src/lib/details-schemas.ts` (Zod, one
schema per habit slug, `.strict()`). This document mirrors those schemas and the
Drizzle tables in `src/db/schema.ts`.

## Global conventions

- **Dates** are `YYYY-MM-DD` strings in the **America/Sao_Paulo** timezone. The
  check date is computed in app code (`todayInSaoPaulo()`), never from the
  database clock (which runs UTC).
- **Times** are `HH:MM` (24h), São Paulo local.
- **Weekdays** are ISO: `1` = Monday … `7` = Sunday.
- **Slugs** (`habits.slug`, `languages.slug`, `spiritual_practices.slug`) are
  stable identifiers — never renamed, only deactivated. `details` references
  entities by id or slug.
- **Every table carries `user_id`** except `habits` (shared catalogue) and
  `workout_plan_days` (reaches its owner through `plan_id`). Slugs and years are
  unique *per account*, not globally: `languages(user_id, slug)`,
  `spiritual_practices(user_id, slug)`, `reading_goals(user_id, year)`.
- **The export is one account's data.** `GET /api/export` returns only the rows
  belonging to the signed-in user, so `user_id` never appears in the payload.
- **`schema_version`** in the export is `2`.

## Tier 0 — accounts

### `users`
Created only by `bun run user:create`; there is no sign-up in the app.
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | Referenced by `user_id` on every table below except `habits` |
| name | varchar(40) | Display form, as typed at creation ("Sofia") |
| handle | varchar(40) UNIQUE | `name` lowercased; carries the uniqueness, so "Sofia" and "sofia" are one account |
| password_hash | text NULL | PBKDF2-SHA256 as `iterations.saltHex.hashHex`. **NULL = unclaimed**: the first sign-in with this name sets it |
| created_at | timestamptz | |

## Tier 1 — spine

### `habits`
The one table **not** scoped to a user: every account tracks the same seven.
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| name | varchar(50) | Display name (seeded pt-BR); UI localizes by slug |
| slug | varchar(50) UNIQUE | Stable id: treino, leitura, sono, rotina, duolingo, espiritualidade, hobby |
| icon | varchar(10) | Legacy emoji from seed; **not rendered** (UI maps slug → lucide icon) |
| optional | boolean | Excluded from progress/adherence/best-worst when true (Hobby) |
| created_at | timestamptz | |

### `daily_checks`
One row per habit per day **per account**. `UNIQUE(user_id, habit_id, checked_at)`.
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| user_id | int FK→users | Whose day this is |
| habit_id | int FK→habits | |
| checked_at | date | São Paulo calendar day; **no DB default** (timezone rule) |
| done | boolean | The binary spine. All v1 views read only this |
| details | jsonb NULL | Tier-2 granular answers, shape per habit slug (below). NULL = "done without details" (v1 rows and quick-toggles) |
| note | text NULL | Free text, always optional |
| created_at / updated_at | timestamptz | |

## Tier 3 — entities

### `workout_plans` (immutable, versioned)
Editing a plan inserts `version+1` and flips `active`; history = `ORDER BY version`.
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| user_id | int FK→users | Whose plan |
| version | int | 1-based; monotonic |
| name | varchar(80) | e.g. "Push/Pull/Legs" |
| active | boolean | Exactly one active at a time |
| created_at | timestamptz | |

### `workout_plan_days`
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | Referenced by `details.plan_day_id` (treino) |
| plan_id | int FK→workout_plans | |
| weekday | int | ISO 1..7 |
| focus | varchar(80) | "Push", "Rest", "Cardio" |
| exercises | jsonb | `[{ name, kind?, sets?, reps?, seconds?, distance?, minutes?, load? }]` (plan config, not a daily log). `kind` is `reps` (default when absent) \| `time` \| `distance`; `reps` applies to `reps`, `seconds` (hold per set) to `time`, `distance` (km) + optional `minutes` to `distance` |

### `reading_goals`
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| user_id | int FK→users | Whose goal |
| year | int UNIQUE | |
| target_books | int | Books to finish that year |
| created_at | timestamptz | |

### `books`
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | Referenced by `details.book_id` (leitura) |
| user_id | int FK→users | Whose list |
| title | varchar(200) | |
| author | varchar(120) NULL | |
| total_pages | int | |
| status | varchar(12) | `queued` \| `reading` \| `done` \| `abandoned` |
| current_page | int | Advanced by daily reading logs |
| position | int | Order in the reading list |
| started_at / finished_at | date NULL | Set when reading starts / the last page is reached |

### `routine_blocks`
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | Referenced by `details.followed_block_ids` / `struggled_block_id` (rotina) |
| user_id | int FK→users | Whose routine |
| start_time / end_time | time | HH:MM |
| activity | varchar(120) | "Deep work", "Gym" |
| weekdays | int[] | ISO weekdays the block applies to |
| active | boolean | Editing deactivates old blocks (ids kept for history) |
| position | int | |

### `spiritual_practices`
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| user_id | int FK→users | Whose practices |
| name | varchar(80) | |
| slug | varchar(80) UNIQUE | Referenced by `details.practices[].slug` |
| countable | boolean | If true, has a daily count (e.g. rosaries) |
| active | boolean | |
| position | int | |

### `languages`
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| user_id | int FK→users | Whose languages |
| name | varchar(50) | |
| slug | varchar(50) UNIQUE | Referenced by `details.sessions[].language_slug` |
| active | boolean | |

### `sleep_targets` (one row per account)
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| user_id | int FK→users | Whose window |
| bedtime / wake_time | time | Target window; sets the daily sleep-hours default. Not referenced by `details` |

## Tier 4 — the values layer

Where Tiers 1–3 record what you did, this records what you said mattered. It is
**append-only**: the question it exists to answer is "what did I say I'd do, and
what happened?", and no system that lets you edit the past can answer it.

Display text is deliberately absent from every table here. Domain names,
descriptions, boundary notes and writing prompts live in
`src/lib/i18n-assessment.ts` keyed by `life_domains.slug`, because the app is
bilingual and a name stored in one language has to be undone on read.

### `life_domains` (12 rows, seeded, shared by everyone)
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| slug | varchar(40) UNIQUE | `family`, `couple`, `parenting`, `friends`, `work`, `education`, `recreation`, `spirituality`, `community`, `health`, `environment`, `art`. Stable, never renamed |
| position | int | Fixed display order, 1–12. Never randomised: shuffling would cut order-effect but destroy comparability between cycles |

### `cycles`
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| user_id | int FK→users | Whose cycle |
| label | varchar(20) | `2026-H2`. Unique per account, derived from the date — there is no cycle UI |
| starts_at / ends_at | date | The half-year the cycle covers |
| status | varchar(10) | `draft` \| `active` \| `closed`. Only `active` is written today |
| closed_at | timestamptz | Set when the cycle is closed (not yet built) |

### `assessments` (one filling-in of the grid)
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| user_id | int FK→users | |
| cycle_id | int FK→cycles | |
| taken_at | date | São Paulo day, from app code. **No database default** |
| kind | varchar(10) | `full` (12 domains) \| `checkin` (priority only). Only `full` is written today |
| context_note | text | Free text: "done in the morning, tired". Matters more than it looks |
| priority_domains | varchar(40)[] | The top-5 cut as domain slugs, **frozen when the assessment is sealed**. Not recomputed on read: a later change to `THRESHOLDS` would otherwise rewrite which domains a past cycle prioritised, while its direction narratives stayed attached to domains no longer in the list |
| completed_at | timestamptz | NULL = a **draft**, still editable. Once set the assessment is sealed and every write is refused |
| voided_at | timestamptz | Sealed in error. Never deleted, never edited, just excluded from reads |

**One open draft per account**, enforced by a partial unique index
(`assessments_one_open_draft ON (user_id) WHERE completed_at IS NULL`) rather
than by convention, so two half-filled grids are unrepresentable.

### `assessment_ratings` (six numbers for one domain)
No `user_id`: it reaches its owner through `assessment_id`, exactly as
`workout_plan_days` does through `plan_id`. Unique on `(assessment_id, domain_id)`.

| Column | Type | Meaning |
|--------|------|---------|
| assessment_id | int FK→assessments | |
| domain_id | int FK→life_domains | |
| possibility | int 1–10 | How possible real change feels here |
| importance_now | int 1–10 | How much it is on your mind this month |
| importance_general | int 1–10 | How much it matters in the life you want. The steady one |
| action | int 1–10 | How much you actually did in the last week |
| action_satisfaction | int 1–10 | How satisfied you are with that action |
| concern | int 1–10 | How much the area worries you |

Each column carries its own named `CHECK … BETWEEN 1 AND 10`, so a violation
names the column that broke.

### `direction_narratives` (written for the priority domains only)
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| user_id | int FK→users | Redundant with `cycle_id`, kept so an ownership filter is one predicate rather than a join |
| cycle_id | int FK→cycles | Unique together with `domain_id` |
| domain_id | int FK→life_domains | |
| raw_reflection | text | The long answer to the domain's writing prompt |
| narrative | text | The one sentence naming the direction |
| source | varchar(12) | `human` \| `ai_suggested` \| `ai_edited`. Always `human` today; the column exists so adding generated drafts needs no backfill |
| accepted_at | timestamptz | When the sentence was accepted as written |

**Derived, never stored:** the seven diagnostic patterns, severities,
`valueActionGap` / `hopeGap` / `anxietyLoad` / `alignment`, and the gap ranking
are all pure functions in `src/lib/diagnose.ts`. Only `priority_domains` is
persisted, and only because freezing it is the point.

**Known gap:** the values layer is **not** in `GET /api/export` yet. Until it
is, an export is a complete record of what you did and no record of why.

## Tier 2 — `daily_checks.details` by habit slug

Validated on every write against `src/lib/details-schemas.ts`. `?` = optional.

- **treino** — `{ plan_day_id: int, completed: [{ name: string, done: bool }], effort?: 1..5 }`
  - `plan_day_id` → `workout_plan_days.id`; `completed` mirrors that day's exercises; `effort` = perceived 1(easy)–5(max).
- **leitura** — `{ book_id: int, ended_on_page: int, pages_read: int }`
  - `book_id` → `books.id`; `pages_read` = ended_on_page − previous current_page.
- **sono** — `{ hours: number, woke_up_at_night: bool, quality?: 1..5 }`
  - `hours` one decimal.
- **rotina** — `{ followed_block_ids: int[], struggled_block_id?: int, struggle_note?: string }`
  - ids → `routine_blocks.id`.
- **duolingo** — `{ sessions: [{ language_slug: string, lessons: int }] }`
  - all-zero lessons = not done.
- **espiritualidade** — `{ practices: [{ slug: string, count?: int }] }`
  - only practices done are listed; `count` present for countable practices.
- **hobby** — `{ activity?: string, minutes?: int }`

## Export endpoint

`GET /api/export?from=YYYY-MM-DD&to=YYYY-MM-DD` → 

```jsonc
{
  "meta": { "from", "to", "timezone": "America/Sao_Paulo", "schema_version": 2 },
  "entities": { "workout_plans": [ /* +nested days, all versions */ ],
                "books", "reading_goals", "routine_blocks",
                "spiritual_practices", "languages", "sleep_targets" },
  "days": [ { "date": "YYYY-MM-DD",
              "habits": { "<slug>": { "done", "details", "note" }, ... } } ]
}
```

The `/overview/[date]` Day Audit screen is the visual twin of one `days[]` object.
