import { z } from "zod";

// One Zod schema per rich template kind — the SINGLE SOURCE OF TRUTH for the
// shape of `habits.config` for a kind that needs more than the Checklist's
// `{items}`. Same idiom as details-schemas.ts, one level up: where `details`
// is the day's answer, `config` is the habit's own setup — a workout's plan,
// a reading list, a set of routine blocks.
//
// Rule carried over from the six owner-shaped tables this replaces: nothing
// in a list is ever hard-removed, only flagged `active: false`. Old
// `daily_checks.details` reference these items by id or slug
// (plan_day_id, book_id, followed_block_ids, struggled_block_id,
// language_slug, practices[].slug) — deleting one would orphan every past day
// that named it. `id`/`slug` values are carried forward unchanged from the
// tables this replaces; nothing here reassigns one.

const exerciseKind = z.enum(["reps", "time", "distance"]);

const plannedExercise = z
  .object({
    name: z.string().describe("Exercise name"),
    kind: exerciseKind.optional().describe("Absent means 'reps'"),
    sets: z.number().int().optional(),
    reps: z.number().int().optional().describe("kind 'reps'"),
    seconds: z.number().int().optional().describe("kind 'time' — hold per set"),
    distance: z.number().optional().describe("kind 'distance' — kilometres"),
    minutes: z.number().optional().describe("kind 'distance' — optional target time"),
    load: z.string().optional(),
  })
  .strict();

export const workoutConfig = z
  .object({
    planName: z.string().max(80),
    days: z
      .array(
        z
          .object({
            id: z.number().int().positive().describe("Stable id — daily_checks.details.plan_day_id points here"),
            weekday: z.number().int().min(1).max(7).describe("ISO: 1=Mon … 7=Sun"),
            focus: z.string().max(80).describe("'Push', 'Rest', 'Cardio'"),
            exercises: z.array(plannedExercise),
            active: z.boolean().describe("false once superseded by a later save — kept for old days' lookups"),
          })
          .strict()
      )
      .describe(
        "Every day ever planned, active and retired. Only the active ones are " +
          "'the current plan' — no separate version history beyond that flag."
      ),
  })
  .strict();

export const readingConfig = z
  .object({
    year: z.number().int(),
    targetBooksPerYear: z.number().int().min(0),
    books: z
      .array(
        z
          .object({
            id: z.number().int().positive().describe("Stable id — daily_checks.details.book_id points here"),
            title: z.string().max(200),
            author: z.string().max(120).nullable(),
            totalPages: z.number().int().positive(),
            currentPage: z.number().int().min(0),
            status: z.enum(["queued", "reading", "done", "abandoned"]),
            position: z.number().int(),
          })
          .strict()
      )
      .describe(
        "A book with zero progress and status queued/reading may be dropped on edit; " +
          "anything with progress, or status done/abandoned, is kept forever for history."
      ),
  })
  .strict();

export const sleepConfig = z
  .object({
    bedtime: z.string().regex(/^\d{2}:\d{2}$/),
    wakeTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .strict();

export const routineConfig = z
  .object({
    blocks: z
      .array(
        z
          .object({
            id: z.number().int().positive().describe("Stable id — details.followed_block_ids / struggled_block_id point here"),
            startTime: z.string().regex(/^\d{2}:\d{2}$/),
            endTime: z.string().regex(/^\d{2}:\d{2}$/),
            activity: z.string().max(120),
            weekdays: z.array(z.number().int().min(1).max(7)),
            position: z.number().int(),
            active: z.boolean(),
          })
          .strict()
      )
      .describe("Inactive blocks stay in the array — never deleted, only flagged"),
  })
  .strict();

export const duolingoConfig = z
  .object({
    languages: z
      .array(
        z
          .object({
            slug: z.string().max(50).describe("details.sessions[].language_slug points here"),
            name: z.string().max(50),
            active: z.boolean(),
          })
          .strict()
      )
      .describe("Inactive languages stay in the array — never deleted, only flagged"),
  })
  .strict();

export const spiritualityConfig = z
  .object({
    practices: z
      .array(
        z
          .object({
            slug: z.string().max(80).describe("details.practices[].slug points here"),
            name: z.string().max(80),
            countable: z.boolean(),
            position: z.number().int(),
            active: z.boolean(),
          })
          .strict()
      )
      .describe("Inactive practices stay in the array — never deleted, only flagged"),
  })
  .strict();

export const checklistConfig = z
  .object({
    items: z.array(z.string().max(80)).describe("Labels the day's check-in ticks against"),
  })
  .strict();

// Keyed by TEMPLATE KIND, same convention as DETAILS_SCHEMAS. Kinds with no
// rich setup (the five card-style kinds, `hobby`) simply have no entry — a
// habit of one of those kinds stores `config: null`.
export const CONFIG_SCHEMAS = {
  treino: workoutConfig,
  leitura: readingConfig,
  sono: sleepConfig,
  rotina: routineConfig,
  duolingo: duolingoConfig,
  espiritualidade: spiritualityConfig,
  checklist: checklistConfig,
} as const;

export type ConfigKind = keyof typeof CONFIG_SCHEMAS;

export type WorkoutConfig = z.infer<typeof workoutConfig>;
export type ReadingConfig = z.infer<typeof readingConfig>;
export type SleepConfig = z.infer<typeof sleepConfig>;
export type RoutineConfig = z.infer<typeof routineConfig>;
export type DuolingoConfig = z.infer<typeof duolingoConfig>;
export type SpiritualityConfig = z.infer<typeof spiritualityConfig>;
export type ChecklistConfig = z.infer<typeof checklistConfig>;

export function isConfigKind(kind: string): kind is ConfigKind {
  return kind in CONFIG_SCHEMAS;
}

// Validates `data` against the schema for a template kind. Throws a ZodError
// on a bad shape — callers at the write boundary (rich-habits.ts) turn that
// into a normal action failure; there's no "degrade gracefully" case here the
// way parseDetails has one, because config is only ever written by the app
// itself, never replayed from an older deploy's row shape.
export function parseConfig(kind: string, data: unknown): unknown {
  if (!isConfigKind(kind)) {
    throw new Error(`"${kind}" has no config schema`);
  }
  return CONFIG_SCHEMAS[kind].parse(data);
}
