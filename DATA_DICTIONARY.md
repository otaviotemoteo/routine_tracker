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
- **`schema_version`** in the export is `2`.

## Tier 1 — spine

### `habits`
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| name | varchar(50) | Display name (seeded pt-BR); UI localizes by slug |
| slug | varchar(50) UNIQUE | Stable id: treino, leitura, sono, rotina, duolingo, espiritualidade, hobby |
| icon | varchar(10) | Legacy emoji from seed; **not rendered** (UI maps slug → lucide icon) |
| optional | boolean | Excluded from progress/adherence/best-worst when true (Hobby) |
| created_at | timestamptz | |

### `daily_checks`
One row per habit per day. `UNIQUE(habit_id, checked_at)`.
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
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
| year | int UNIQUE | |
| target_books | int | Books to finish that year |
| created_at | timestamptz | |

### `books`
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | Referenced by `details.book_id` (leitura) |
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
| start_time / end_time | time | HH:MM |
| activity | varchar(120) | "Deep work", "Gym" |
| weekdays | int[] | ISO weekdays the block applies to |
| active | boolean | Editing deactivates old blocks (ids kept for history) |
| position | int | |

### `spiritual_practices`
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| name | varchar(80) | |
| slug | varchar(80) UNIQUE | Referenced by `details.practices[].slug` |
| countable | boolean | If true, has a daily count (e.g. rosaries) |
| active | boolean | |
| position | int | |

### `languages`
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| name | varchar(50) | |
| slug | varchar(50) UNIQUE | Referenced by `details.sessions[].language_slug` |
| active | boolean | |

### `sleep_targets` (single row)
| Column | Type | Meaning |
|--------|------|---------|
| id | serial PK | |
| bedtime / wake_time | time | Target window; sets the daily sleep-hours default. Not referenced by `details` |

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
