import { z } from "zod";

// One Zod schema per habit slug — the SINGLE SOURCE OF TRUTH for the shape of
// `daily_checks.details`. It (1) validates every write at the API boundary,
// (2) generates the TypeScript types below via z.infer, and (3) feeds
// docs/DATA_DICTIONARY.md through the `.describe()` metadata on every field.
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

// The generic habit's daily answer: one number on the habit's own metric.
//
// A `binary` habit stores 1 or 0 — redundant with `done`, and deliberately so.
// The alternative is a null `details` for binary habits, which would make
// every reader branch on the metric before it could read the value. One shape
// for all three metrics is worth one duplicated bit.
export const plainDetails = z
  .object({
    value: z
      .number()
      .min(0)
      .describe(
        "The day's figure on the habit's own metric: 1/0 for binary, " +
          "a count for count, minutes for duration"
      ),
  })
  .strict();

// Keyed by TEMPLATE KIND, not by slug.
//
// It used to be keyed by slug, and for the seven original habits nothing
// changed — their template kind IS their old slug. What the rekeying buys is
// that two people can both have a habit slugged "leitura" without colliding,
// and that a habit with no template still has somewhere to put its number.
export const DETAILS_SCHEMAS = {
  treino: workoutDetails,
  leitura: readingDetails,
  sono: sleepDetails,
  rotina: routineDetails,
  duolingo: duolingoDetails,
  espiritualidade: spiritualityDetails,
  hobby: hobbyDetails,
  plain: plainDetails,
} as const;

export type DetailsSlug = keyof typeof DETAILS_SCHEMAS;

export type WorkoutDetails = z.infer<typeof workoutDetails>;
export type ReadingDetails = z.infer<typeof readingDetails>;
export type SleepDetails = z.infer<typeof sleepDetails>;
export type RoutineDetails = z.infer<typeof routineDetails>;
export type DuolingoDetails = z.infer<typeof duolingoDetails>;
export type SpiritualityDetails = z.infer<typeof spiritualityDetails>;
export type HobbyDetails = z.infer<typeof hobbyDetails>;
export type PlainDetails = z.infer<typeof plainDetails>;

export function isDetailsSlug(slug: string): slug is DetailsSlug {
  return slug in DETAILS_SCHEMAS;
}

// Validates `data` against the schema for a template kind. Returns the parsed
// value or throws a ZodError; the API layer turns a failure into a 422.
//
// A null kind (a habit with no template — the normal case now) validates
// against the plain schema rather than being rejected. Before the remodel an
// unknown slug meant a bug; now it means an ordinary habit.
export function parseDetails(kind: string | null, data: unknown): unknown {
  const key = kind === null ? "plain" : kind;
  if (!isDetailsSlug(key)) {
    // An unknown kind still falls back to plain rather than throwing: a row
    // written by a newer deploy should degrade on an older one, not 422.
    return plainDetails.parse(data);
  }
  return DETAILS_SCHEMAS[key].parse(data);
}
