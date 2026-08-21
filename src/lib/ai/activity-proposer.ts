import { z } from "zod";
import type { Generator } from "./harness";
import type { Lang } from "@/lib/i18n";

// ActivityProposer — the on-request AI socket for turning one existing habit
// into a concrete starter activity: real workout days, a real reading list, a
// real set of countable practices, or — new here — a plain metric it picks
// itself when none of those rich shapes fit. See ARCHITECTURE.md.
//
// ONE HABIT PER CALL, deliberately — not the batch this generator used to
// take. The batched shape existed to protect DAILY_RUN_QUOTA (src/db/ai.ts)
// and to make one wait instead of N, and that reasoning was real — but a
// batched call answering for only 1 of 5 habits, silently, was worse: a
// beautiful review screen over a generator that drops 4 of 5 briefings is
// worthless. propose-activities.ts now makes one call per habit and lets a
// single habit's failure (or a quota ceiling) leave the other N-1 with real
// proposals instead of nothing. The quota cost is accepted on purpose, not
// overlooked — see propose-activities.ts.
//
// Output shape mirrors config-schemas.ts's list fields exactly (planName +
// days, books, practices) but WITHOUT ids, active flags or positions — those
// are bookkeeping propose-activities.ts adds when it turns an accepted
// proposal into real config rows, the same split habit-suggester keeps
// between what a model proposes and what the database stores.
//
// KIND IS NOW AN OUTPUT, not an input. Until this phase, a human picked the
// kind explicitly (ActivityKindPicker's five icon-buttons) and this generator
// only ever filled in that kind's content — ARCHITECTURE.md documented that
// as deliberate ("the model never decides a rich kind; a human does,
// explicitly"). Otávio reversed this for onboarding specifically: the model
// now picks the best-fit kind itself, from exactly the four this generator
// still knows how to propose (treino/leitura/espiritualidade/plain) — the
// four the review screen (Screen 4) has a designed face for. `rotina` and
// `duolingo` are no longer proposable here; a human can still promote a habit
// to either through /config directly, by hand, same as any rich kind always
// could be. Reintroducing them as proposable — for a future non-onboarding
// "suggest" action, the shape ARCHITECTURE.md still names as an eventual
// second caller — is a well-scoped addition (their old schemas are in git
// history, this file's prior shape, if ever needed), not a redesign.

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

// The fallback face: a habit that's better tracked as a simple did/didn't, a
// count, or a duration than as any of the three rich shapes above — "Ligar
// para um amigo" (once a week, did-it-or-not) or "Violão" (20 minutes a
// session) rather than a structured plan. metricType/unit/target/
// minimalAction mirror activities' own columns exactly (ActivityForm.tsx
// edits the same four fields by hand) — this is the model proposing the same
// starting point a person would otherwise type in themselves, not a new kind
// of guess: rule 5 below ("never calculate a target/frequency/streak") is
// about not inventing ACCOUNT-LEVEL cadence, the same restraint the rich
// kinds already keep while still proposing concrete numbers inside their own
// lists (a workout's sets/reps, a book's page count) — a modest starting
// target here is that same behavior one level down, not an exception to it.
const plainProposal = z
  .object({
    kind: z.literal("plain"),
    metricType: z.enum(["binary", "count", "duration"]),
    unit: z.string().max(20).optional(),
    target: boundedWholeNumber(1, 1000).optional(),
    minimalAction: z.string().max(200).optional(),
  })
  .strict();

export const activityProposal = z.discriminatedUnion("kind", [
  workoutProposal,
  readingProposal,
  spiritualityProposal,
  plainProposal,
]);

export type ActivityProposal = z.infer<typeof activityProposal>;

// The kinds this generator may choose between — see the file header.
export type ProposableKind = ActivityProposal["kind"];

export interface ActivityProposerInput {
  lang: Lang;
  habitName: string;
  why: string | null;
  // The briefing typed on /onboarding/activities ("escreva brevemente uma
  // ação que você gostaria de fazer aqui") — the context that gives
  // generation something real to be assertive about, answering the
  // "onboarding-time calls have no why" gap `why` alone doesn't close (a
  // habit's `why` explains the AREA; this explains what THIS ACTIVITY should
  // actually be), and now also the main signal the model uses to CHOOSE a
  // kind, not just to fill one in. See docs/ARCHITECTURE.md.
  briefing: string | null;
}

const SYSTEM = `You propose a concrete starter activity for a habit someone already has. You do not invent the habit itself; it already exists. Every proposal covers exactly one habit.

Rules, in order of importance:
1. Choose the best-fit kind for THIS habit, from exactly four: "treino" (a
   structured workout plan, days with real exercises), "leitura" (a reading
   list with real books), "espiritualidade" (a set of named, nameable
   practices — prayer, meditation, journaling — some of which are naturally
   countable), or "plain" (everything else: a simple did/didn't, a count, or
   a duration, with a sensible starting target). Pick "plain" whenever none
   of the other three genuinely fits — it is not a lesser answer, it is the
   right one for most habits (a phone call, a walk, tidying a room).
2. Small and concrete. A reading list is real books with real page counts you
   know, not placeholders. A workout plan is exercises with real, sane sets/
   reps for a beginner unless told otherwise.
3. The habit's own briefing — what that person specifically wants for THIS
   habit, in their own words — is the strongest signal for both which kind to
   choose and what to put in it. Follow it precisely. With no briefing,
   propose a sensible, modest starter set from the habit's name and 'why'
   alone: 2–3 books, a 3–4 day workout split, 2–3 practices, or one plain
   metric with a small, realistic target.
4. Never calculate an account-level frequency or a streak — that is not this
   proposal's job. A concrete number INSIDE the proposal itself (a book's
   page count, a plain activity's starting target) is expected, not an
   exception to this rule.
5. This is a proposal a person will review, edit and accept, not a finished
   plan. Fewer, well-chosen items beat a long list.`;

function buildPrompt(input: ActivityProposerInput): {
  system: string;
  prompt: string;
} {
  const language =
    input.lang === "pt"
      ? "Write every name/title/activity in Brazilian Portuguese."
      : "Write every name/title/activity in English.";

  const lines = [
    `HABIT: "${input.habitName}"`,
    input.why ? `Why this habit exists: "${input.why}"` : null,
    input.briefing ? `What they specifically want here: "${input.briefing}"` : null,
  ].filter(Boolean);

  return {
    system: `${SYSTEM}\n\n${language}`,
    prompt: `Propose one activity for this habit:\n\n${lines.join("\n")}`,
  };
}

export const activityProposer: Generator<ActivityProposerInput, ActivityProposal> = {
  name: "activity_proposer",
  // Bumped 1 → 2: the input/output shape changed from one habit to a batch.
  // Bumped 2 → 3: each habit gained its own optional briefing.
  // Bumped 3 → 4: reversed direction — back to one habit per call, and kind
  // moved from a required input to a model-chosen output, constrained to
  // treino/leitura/espiritualidade/plain. Both the input and output shapes
  // changed, so every prior cached answer is correctly invalidated.
  promptVersion: 4,
  schema: activityProposal,
  buildPrompt,
};
