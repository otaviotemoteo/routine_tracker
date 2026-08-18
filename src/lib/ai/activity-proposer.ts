import { z } from "zod";
import type { Generator } from "./harness";
import type { RichTemplateKind } from "@/lib/templates";
import type { Lang } from "@/lib/i18n";

// ActivityProposer — the generator behind a rich habit's "suggest" action and
// its free-text sibling ("recommend me 5 fiction books", "build me a
// Monday–Friday training plan"). One generator across five kinds (`sono` is
// excluded — a bedtime/wake pair is a preference someone states directly,
// not a list a model has anything to propose), on request only: see
// propose-activities.ts for the "never unprompted" rule this enforces.
//
// Output shape mirrors config-schemas.ts's list fields exactly (planName +
// days, books, blocks, languages, practices) but WITHOUT ids, active flags or
// positions — those are bookkeeping propose-activities.ts adds when it turns
// an accepted proposal into real config rows, the same split habit-suggester
// keeps between what a model proposes and what the database stores.

const exerciseKind = z.enum(["reps", "time", "distance"]);

const exercise = z
  .object({
    name: z.string().max(60),
    kind: exerciseKind.optional(),
    sets: z.number().int().optional(),
    reps: z.number().int().optional(),
    seconds: z.number().int().optional(),
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
            weekday: z.number().int().min(1).max(7),
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
            totalPages: z.number().int().positive(),
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
            weekdays: z.array(z.number().int().min(1).max(7)).min(1),
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

export interface ActivityProposerInput {
  lang: Lang;
  habitName: string;
  why: string | null;
  kind: ProposableKind;
  // Set only for the free-text form ("recommend me 5 fiction books"); absent
  // for the plain "suggest" action, which works from habitName/why alone.
  request: string | null;
}

const SYSTEM = `You propose ONE small starter set of concrete activities for a habit someone already has — a workout plan's days, a reading list, a set of routine time blocks, languages to practice, or spiritual practices. You do not invent the habit itself; it already exists.

Rules, in order of importance:
1. Answer only in the ONE kind you were asked for. Never propose a different kind.
2. Small and concrete. A reading list is real books with real page counts you
   know, not placeholders. A workout plan is exercises with real, sane sets/
   reps for a beginner unless told otherwise.
3. If given an explicit request ("recommend me 5 fiction books", "a Monday to
   Friday plan"), follow it precisely — the count, the days, the constraint.
   If given no request, propose a sensible, modest starter set from the
   habit's name and its 'why' alone: 2–3 books, a 3–4 day workout split, a
   handful of time blocks, 1–2 languages, 2–3 practices.
4. Never calculate a target, a frequency or a streak — that is not this
   proposal's job.
5. This is a proposal a person will review, edit and accept item by item, not
   a finished plan. Fewer, well-chosen items beat a long list.`;

function buildPrompt(input: ActivityProposerInput): {
  system: string;
  prompt: string;
} {
  const language =
    input.lang === "pt"
      ? "Write every name/title/activity in Brazilian Portuguese."
      : "Write every name/title/activity in English.";

  const context = [
    `Habit: ${input.habitName}`,
    input.why ? `Why this habit exists: "${input.why}"` : null,
    input.request ? `The person's specific request: "${input.request}"` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    system: `${SYSTEM}\n\n${language}`,
    prompt: `${context}\n\nPropose a "${input.kind}" activity set for this habit.`,
  };
}

export const activityProposer: Generator<ActivityProposerInput, ActivityProposal> = {
  name: "activity_proposer",
  promptVersion: 1,
  schema: activityProposal,
  buildPrompt,
};
