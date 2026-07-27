import { z } from "zod";

// One Zod schema per habit slug — the SINGLE SOURCE OF TRUTH for the shape of
// `daily_checks.details`. It (1) validates every write at the API boundary,
// (2) generates the TypeScript types below via z.infer, and (3) feeds
// DATA_DICTIONARY.md through the `.describe()` metadata on every field.
//
// Rule: `details` references entities by id/slug (book_id, plan_day_id,
// language_slug). Entities are the nouns; details are the daily verbs.

const rating = z.number().int().min(1).max(5);

export const workoutDetails = z
  .object({
    plan_day_id: z
      .number()
      .int()
      .positive()
      .describe("workout_plan_days.id whose plan this day followed"),
    completed: z
      .array(
        z.object({
          name: z.string().describe("Exercise name, mirrors the plan"),
          done: z.boolean().describe("Whether this exercise was completed"),
        })
      )
      .describe("Per-exercise completion for the day's planned focus"),
    effort: rating.optional().describe("Perceived effort, 1 (easy)–5 (max)"),
  })
  .strict();

export const readingDetails = z
  .object({
    book_id: z.number().int().positive().describe("books.id being read"),
    ended_on_page: z
      .number()
      .int()
      .min(0)
      .describe("Page number the reader stopped on today"),
    pages_read: z
      .number()
      .int()
      .min(0)
      .describe("Pages read today (ended_on_page minus previous current_page)"),
  })
  .strict();

export const sleepDetails = z
  .object({
    hours: z
      .number()
      .min(0)
      .max(24)
      .describe("Hours slept, one decimal (e.g. 7.5)"),
    woke_up_at_night: z
      .boolean()
      .describe("Whether the night's sleep was interrupted"),
    quality: rating.optional().describe("Subjective sleep quality, 1–5"),
  })
  .strict();

export const routineDetails = z
  .object({
    followed_block_ids: z
      .array(z.number().int().positive())
      .describe("routine_blocks.id values actually followed today"),
    struggled_block_id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("routine_blocks.id that was hardest today"),
    struggle_note: z
      .string()
      .max(280)
      .optional()
      .describe("Short free text on what made that block hard"),
  })
  .strict();

export const duolingoDetails = z
  .object({
    sessions: z
      .array(
        z.object({
          language_slug: z
            .string()
            .describe("languages.slug practiced"),
          lessons: z
            .number()
            .int()
            .min(0)
            .describe("Number of lessons completed in this language"),
        })
      )
      .describe("Lessons per active language; all zero means not done"),
  })
  .strict();

export const spiritualityDetails = z
  .object({
    practices: z
      .array(
        z.object({
          slug: z
            .string()
            .describe("spiritual_practices.slug performed"),
          count: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe("Repetitions for countable practices (e.g. 2 rosaries)"),
        })
      )
      .describe("Practices done today, with a count for countable ones"),
  })
  .strict();

export const hobbyDetails = z
  .object({
    activity: z
      .string()
      .max(120)
      .optional()
      .describe("What the hobby session was (free text)"),
    minutes: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Minutes spent on the hobby"),
  })
  .strict();

// Keyed by habit slug. A slug with no entry accepts no details.
export const DETAILS_SCHEMAS = {
  treino: workoutDetails,
  leitura: readingDetails,
  sono: sleepDetails,
  rotina: routineDetails,
  duolingo: duolingoDetails,
  espiritualidade: spiritualityDetails,
  hobby: hobbyDetails,
} as const;

export type DetailsSlug = keyof typeof DETAILS_SCHEMAS;

export type WorkoutDetails = z.infer<typeof workoutDetails>;
export type ReadingDetails = z.infer<typeof readingDetails>;
export type SleepDetails = z.infer<typeof sleepDetails>;
export type RoutineDetails = z.infer<typeof routineDetails>;
export type DuolingoDetails = z.infer<typeof duolingoDetails>;
export type SpiritualityDetails = z.infer<typeof spiritualityDetails>;
export type HobbyDetails = z.infer<typeof hobbyDetails>;

export function isDetailsSlug(slug: string): slug is DetailsSlug {
  return slug in DETAILS_SCHEMAS;
}

// Validates `data` against the schema for `slug`. Returns the parsed value or
// throws a ZodError; the API layer turns a failure into a 422.
export function parseDetails(slug: string, data: unknown): unknown {
  if (!isDetailsSlug(slug)) {
    throw new z.ZodError([
      { code: "custom", path: [], message: `No details schema for "${slug}"` },
    ]);
  }
  return DETAILS_SCHEMAS[slug].parse(data);
}
