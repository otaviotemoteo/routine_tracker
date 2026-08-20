import { z } from "zod";
import type { Generator } from "./harness";
import type { RichTemplateKind } from "@/lib/templates";
import type { Lang } from "@/lib/i18n";

// ActivityProposer — the general on-request AI socket for turning an
// existing habit into concrete activities. Not a single-purpose "activity
// generator" so much as the one door any future on-request AI iteration on a
// habit's setup should go through (see ARCHITECTURE.md) — this is
// its first and, for now, only shape: propose a starter activity set for one
// or more rich-kind habits at once.
//
// BATCHED, deliberately — one call for every umbrella habit the onboarding
// activity step is showing, not one call per habit. Two reasons, both load-
// bearing: DAILY_RUN_QUOTA (src/db/ai.ts) is a flat per-account daily count
// shared across every generator, so N habits × N calls would burn a first
// session's whole budget before anyone reaches Today; and it's one wait
// instead of N, which matters when a single call already measures in the
// tens of seconds (see providers.ts's latency note). On request only — see
// propose-activities.ts for the "never unprompted" rule this enforces.
//
// Output shape mirrors config-schemas.ts's list fields exactly (planName +
// days, books, blocks, languages, practices) but WITHOUT ids, active flags or
// positions — those are bookkeeping propose-activities.ts adds when it turns
// an accepted proposal into real config rows, the same split habit-suggester
// keeps between what a model proposes and what the database stores.

// Some structured-output models emit a whole number as a JSON float literal
// ("3.0") even for a field meant to be an integer — found live, via this
// file's own test, as gemini-3.6-flash's answer failing `sets`/`reps` with
// "expected integer, received float" (the JSON-Schema `integer` type Zod's
// `.int()` compiles to is stricter about the literal's shape than the value
// itself). Rounding instead of requiring `.int()` accepts that shape without
// weakening what ends up in the database: config-schemas.ts's own `.int()`
// still enforces a true integer at the point these values are actually
// written — this only relaxes the boundary a model's raw JSON has to clear.
const wholeNumber = z.number().transform((n) => Math.round(n));
const boundedWholeNumber = (min: number, max: number) =>
  z.number().min(min).max(max).transform((n) => Math.round(n));

const exerciseKind = z.enum(["reps", "time", "distance"]);

const exercise = z
  .object({
    name: z.string().max(60),
    kind: exerciseKind.optional(),
    sets: wholeNumber.optional(),
    reps: wholeNumber.optional(),
    seconds: wholeNumber.optional(),
    distance: z.number().optional(),
    minutes: z.number().optional(),
  })
  .strict();

const workoutProposal = z
  .object({
    kind: z.literal("treino"),
    planName: z.string().max(80),
    days: z
      .array(
        z
          .object({
            weekday: boundedWholeNumber(1, 7),
            focus: z.string().max(80),
            exercises: z.array(exercise).min(1),
          })
          .strict()
      )
      .min(1)
      .max(7),
  })
  .strict();

const readingProposal = z
  .object({
    kind: z.literal("leitura"),
    books: z
      .array(
        z
          .object({
            title: z.string().max(200),
            author: z.string().max(120).optional(),
            totalPages: boundedWholeNumber(1, 20000),
          })
          .strict()
      )
      .min(1)
      .max(20),
  })
  .strict();

const routineProposal = z
  .object({
    kind: z.literal("rotina"),
    blocks: z
      .array(
        z
          .object({
            startTime: z.string().regex(/^\d{2}:\d{2}$/),
            endTime: z.string().regex(/^\d{2}:\d{2}$/),
            activity: z.string().max(120),
            weekdays: z.array(boundedWholeNumber(1, 7)).min(1),
          })
          .strict()
      )
      .min(1)
      .max(20),
  })
  .strict();

const duolingoProposal = z
  .object({
    kind: z.literal("duolingo"),
    languages: z
      .array(z.object({ name: z.string().max(50) }).strict())
      .min(1)
      .max(10),
  })
  .strict();

const spiritualityProposal = z
  .object({
    kind: z.literal("espiritualidade"),
    practices: z
      .array(
        z
          .object({ name: z.string().max(80), countable: z.boolean() })
          .strict()
      )
      .min(1)
      .max(15),
  })
  .strict();

export const activityProposal = z.discriminatedUnion("kind", [
  workoutProposal,
  readingProposal,
  routineProposal,
  duolingoProposal,
  spiritualityProposal,
]);

export type ActivityProposal = z.infer<typeof activityProposal>;

// Every kind the proposer accepts — `sono` is deliberately absent from
// RICH_TEMPLATE_KINDS' use here, not from the type: a caller passing "sono"
// is a caller bug, not a model failure, and TypeScript is the wall for it.
export type ProposableKind = Exclude<RichTemplateKind, "sono" | "hobby">;

export interface ActivityBatchHabit {
  habitName: string;
  why: string | null;
  // The per-habit briefing typed on /onboarding/activities ("escreva
  // brevemente uma ação que você gostaria de fazer aqui") — the context that
  // gives generation something real to be assertive about, answering the
  // "onboarding-time calls have no why" gap `why` alone doesn't close (a
  // habit's `why` explains the AREA; this explains what THIS ACTIVITY should
  // actually be). Parallel to `why`, not a replacement for it — both travel
  // to the model when present. See docs/ARCHITECTURE.md.
  briefing: string | null;
  kind: ProposableKind;
}

export interface ActivityProposerInput {
  lang: Lang;
  // One or more habits, all proposed in the same call. Order matters: the
  // schema has no id field for the model to echo back (models are worse at
  // exactly copying arbitrary integers than at preserving list order), so
  // the caller zips `perHabit[i]` back to `habits[i]` by POSITION — see
  // propose-activities.ts.
  habits: ActivityBatchHabit[];
  // Applies to the whole batch — set only for the free-text form
  // ("recommend me 5 fiction books for my reading habit"); absent for the
  // plain "suggest" action, which works from each habit's name/why alone.
  request: string | null;
}

// One proposal per input habit, in the SAME ORDER as `habits` above — never
// keyed by an id the model would have to invent or copy.
export const activityBatchProposal = z
  .object({
    perHabit: z.array(activityProposal).min(1).max(12),
  })
  .strict();

export type ActivityBatchProposal = z.infer<typeof activityBatchProposal>;

const SYSTEM = `You propose small starter sets of concrete activities for habits someone already has — a workout plan's days, a reading list, a set of routine time blocks, languages to practice, or spiritual practices. You do not invent the habits themselves; they already exist. You may be given one habit or several at once; treat each independently.

Rules, in order of importance:
1. Answer for EVERY habit listed, in the exact same order they were given —
   your first proposal is for the first habit listed, your second for the
   second, and so on. One proposal per habit, no more, no fewer. If N habits
   are listed, perHabit MUST have exactly N entries — never stop early, even
   if the first habit's proposal already feels complete.
2. Each proposal's kind must match that specific habit's kind exactly. Never
   swap kinds between habits.
3. Small and concrete. A reading list is real books with real page counts you
   know, not placeholders. A workout plan is exercises with real, sane sets/
   reps for a beginner unless told otherwise.
4. Each habit may carry its OWN briefing — what that person specifically
   wants for THIS habit, in their own words. Follow it precisely for that
   habit. If given an explicit whole-batch request as well ("recommend me 5
   fiction books"), that applies too, but a habit's own briefing is the more
   specific instruction and wins if the two ever pull in different
   directions. For any habit with neither, propose a sensible, modest
   starter set from its name and 'why' alone: 2–3 books, a 3–4 day workout
   split, a handful of time blocks, 1–2 languages, 2–3 practices.
5. Never calculate a target, a frequency or a streak — that is not this
   proposal's job.
6. This is a proposal a person will review, edit and accept item by item, not
   a finished plan. Fewer, well-chosen items beat a long list.`;

function buildPrompt(input: ActivityProposerInput): {
  system: string;
  prompt: string;
} {
  const language =
    input.lang === "pt"
      ? "Write every name/title/activity in Brazilian Portuguese."
      : "Write every name/title/activity in English.";

  const habits = input.habits
    .map((h, i) => {
      const lines = [
        `HABIT ${i + 1} (kind: ${h.kind}): "${h.habitName}"`,
        h.why ? `  Why this habit exists: "${h.why}"` : null,
        h.briefing ? `  What they specifically want here: "${h.briefing}"` : null,
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n");

  const request = input.request
    ? `\nThe person's specific request: "${input.request}"`
    : "";

  return {
    system: `${SYSTEM}\n\n${language}`,
    prompt: `Here ${input.habits.length === 1 ? "is the habit" : "are the habits"} to propose activities for, in order:

${habits}
${request}

Propose one activity set per habit above, in the same order, matching each habit's own kind. There ${input.habits.length === 1 ? "is 1 habit" : `are ${input.habits.length} habits`} listed — perHabit must have exactly ${input.habits.length} ${input.habits.length === 1 ? "entry" : "entries"}.`,
  };
}

export const activityProposer: Generator<
  ActivityProposerInput,
  ActivityBatchProposal
> = {
  name: "activity_proposer",
  // Bumped 1 → 2: the input/output shape changed from one habit to a batch —
  // a cached single-habit answer is not a valid answer to the batched schema.
  // Bumped 2 → 3: each habit now carries its own optional briefing, which
  // changes what the prompt says even for a request whose other fields are
  // identical to a cached one.
  promptVersion: 3,
  schema: activityBatchProposal,
  buildPrompt,
};
