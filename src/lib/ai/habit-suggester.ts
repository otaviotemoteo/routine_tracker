import { z } from "zod";
import type { Generator } from "./harness";
import { SUGGESTABLE_TEMPLATE_KINDS } from "@/lib/templates";
import { DOMAIN_SLUGS, type DomainSlug } from "@/lib/domains";
import type { Finding, Pattern } from "@/lib/diagnose";
import type { Lang } from "@/lib/i18n";

// HabitSuggester — the first generator, taken all the way through.
//
// Input: the areas someone prioritised, what they wrote about each, and what
// the diagnostic engine found there. Output: one or two candidate UMBRELLA
// habits per area, which a human then edits, removes or accepts.
//
// "Umbrella" is load-bearing (see ARCHITECTURE.md): a habit here is
// one zoom level below the life area itself ("physical activity" for Health)
// and one zoom level above a concrete, dated gesture ("Monday's workout") —
// the latter is an ACTIVITY, generated later, for a specific habit, only on
// request. This generator never proposes an activity and never proposes the
// area's own name back. `templateKind` stays 'plain' unconditionally: a rich
// kind is reached only when a human generates and accepts activities for a
// specific habit afterward (src/lib/ai/activity-proposer.ts) — never something
// this generator decides on its own. See SUGGESTABLE_TEMPLATE_KINDS in
// src/lib/templates.ts for why that stays narrow even though this generator's
// idea of "a habit" got broader.

// ─── The schema ──────────────────────────────────────────────────────────────
//
// Three prohibitions are enforced HERE, by the shape of the type, rather than
// by a sentence in the prompt. A prompt is a request; a schema is a wall.

const suggestion = z
  .object({
    name: z
      .string()
      .min(1)
      .max(50)
      .describe(
        "A general, ongoing UMBRELLA habit — one zoom level below the life " +
          "area itself, e.g. 'physical activity' for the Health area. Not the " +
          "area's own name back, and not a specific dated gesture like " +
          "'Monday workout at 6pm' — that's an activity, proposed later, for " +
          "this habit specifically."
      ),
    minimalAction: z
      .string()
      .min(1)
      .max(200)
      .describe("The smallest version that still counts on a bad day"),
    metricType: z
      .enum(["binary", "count", "duration"])
      .describe("binary = did it or didn't; count = how many; duration = how long"),
    unit: z
      .string()
      .max(20)
      .optional()
      .describe("What the number counts ('pages', 'minutes'). Omit for binary."),

    // (1) NO TEMPLATE THAT CANNOT RENDER.
    // One member this phase, unchanged by the umbrella/activity split above:
    // this generator still only ever proposes the generic renderer. See
    // src/lib/templates.ts.
    templateKind: z
      .enum(SUGGESTABLE_TEMPLATE_KINDS)
      .describe("Always 'plain'."),

    why: z
      .string()
      .min(1)
      .max(200)
      .describe("One line: how this habit serves what they wrote about the area"),
  })
  // (2) NO CONFIG, and no field the model was not asked for. Letting a model
  // write JSON into a JSONB column is the exact failure this whole
  // schema-validated design exists to prevent.
  .strict();

// (3) NO NUMERIC FIELDS ANYWHERE. There is no `target`, no count, no
// frequency. "AI never calculates" is a property of this type, not a request
// in a prompt — the human fills the target in on a form.
export const habitSuggestions = z
  .object({
    perArea: z
      .array(
        z
          .object({
            domainSlug: z.enum(DOMAIN_SLUGS),
            // 1–2, not 2–3: an umbrella habit is already one zoom level up
            // from a concrete action, so most areas need exactly one — three
            // would start re-enacting the area's own substructure.
            habits: z.array(suggestion).min(1).max(2),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

export type HabitSuggestions = z.infer<typeof habitSuggestions>;
export type HabitSuggestion = z.infer<typeof suggestion>;

// ─── The input ───────────────────────────────────────────────────────────────

export interface SuggesterArea {
  domainSlug: DomainSlug;
  // The English domain name, so the prompt reads naturally regardless of the
  // UI language.
  domainName: string;
  // The area's own description/boundary (also always English — see above).
  // Previously unused by this prompt; now load-bearing: the model needs
  // somewhere to read what the area actually covers, so an umbrella habit can
  // sit clearly BELOW that scope instead of restating it.
  domainDescription: string;
  domainBoundary: string;
  // What the person wrote. The most personal text in the app.
  narrative: string;
  rawReflection: string;
  findings: Finding[];
}

export interface SuggesterInput {
  lang: Lang;
  areas: SuggesterArea[];
}

// Each pattern in a sentence, so the prompt carries meaning rather than a
// constant name. Phrased as observations, never as diagnoses — the grade is
// self-report, and copy that reads a mood off a number is how this becomes a
// self-criticism machine.
const PATTERN_TEXT: Record<Pattern, string> = {
  LIVING_GAP: "says this matters a great deal, but has barely acted on it",
  EMPTY_ACTION: "acts on this a lot, but the effort is not satisfying",
  HOPELESSNESS: "says this matters, but feels it is out of reach",
  ANXIETY_NO_ACTION: "worries about this a lot, but has acted little",
  POSTPONED: "says this matters in general, but not right now",
  AUTOPILOT: "acts on this a lot, but says it matters little",
  BLIND_SPOT: "registers almost nothing here at all",
};

function describeFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    // The empty case is a FIRST-CLASS branch, not an edge case.
    //
    // The only sealed assessment this was developed against produces zero
    // findings across all twelve areas — importance and possibility sit near
    // 10 almost throughout, so no pattern crosses a threshold. A prompt that
    // leaned on findings would therefore be built and judged entirely on its
    // degraded path, and would look fine while being untested.
    return (
      "  No pattern crossed a threshold in this area. That is normal and is " +
      "not a problem to solve — work from what they wrote instead, and do " +
      "not invent a difficulty they did not describe."
    );
  }
  return findings
    .map((f) => {
      const evidence = Object.entries(f.evidence)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      return `  - ${PATTERN_TEXT[f.pattern]} (${evidence})`;
    })
    .join("\n");
}

const SYSTEM = `You help someone turn what they wrote about their own life into a small number of UMBRELLA habits.

Rules, in order of importance:

1. Propose UMBRELLA habits — not single actions, and not the area's own name
   back. An umbrella is the general, ongoing thing a life area translates
   into: "physical activity" for Health, "reading" for Education, "family
   time" for Family. It is concrete enough to track and act on, but general
   enough to hold several different specific activities inside it later (a
   Monday workout, a Wednesday run — those come later, from this habit, on
   request, not from you here). Two failure modes, avoid both equally:
     - naming the area back ("Health" is not a habit — it's the area)
     - naming one specific gesture ("30-minute run every Monday at 6pm" is
       already an activity, not an umbrella)
2. Propose habits that serve what THEY wrote. Their own words are the brief.
   Never propose a generic self-improvement habit that ignores them.
3. Small enough to matter on a bad day. A habit nobody keeps is worth
   nothing, and this app is judged on whether people are still using it in
   week three — "the smallest version that still counts" should make sense
   even for an umbrella.
4. Never diagnose, never grade, never praise. The numbers you are shown are
   self-reported answers, not measurements of a person. Do not infer a mood,
   do not call anything a failure, and do not congratulate.
5. Do not calculate. Never state a frequency, a target, a streak or any
   number. The person sets those themselves.
6. If an area has no findings, that is normal. Work from what they wrote.

For each area give 1 or 2 umbrella habits — most areas need only one; fewer,
broader habits beat several narrow ones. 'why' is one line saying how the
habit serves what they wrote — quote their language where you can, so they
recognise it as theirs.`;

function buildPrompt(input: SuggesterInput): {
  system: string;
  prompt: string;
} {
  const language =
    input.lang === "pt"
      ? "Write every habit name, minimal action and 'why' in Brazilian Portuguese."
      : "Write every habit name, minimal action and 'why' in English.";

  const areas = input.areas
    .map(
      (area) => `
AREA: ${area.domainName} (slug: ${area.domainSlug})
What this area covers: ${area.domainDescription}
What does NOT belong here: ${area.domainBoundary}
What they want to move toward:
  "${area.narrative}"
${
  area.rawReflection
    ? `In their own longer words:\n  "${area.rawReflection.slice(0, 1200)}"`
    : ""
}
What the assessment noticed:
${describeFindings(area.findings)}`
    )
    .join("\n");

  return {
    system: `${SYSTEM}\n\n${language}`,
    prompt: `Here are the areas this person chose to work on this cycle.

${areas}

Propose 1–2 umbrella habits for each area, using the slug given for each.`,
  };
}

export const habitSuggester: Generator<SuggesterInput, HabitSuggestions> = {
  name: "habit_suggester",
  // Bumped 1 → 2: the prompt and the schema both changed (concrete actions →
  // umbrella habits, 2–3 → 1–2 per area) — see the file header. Invalidates
  // every cached answer, which is exactly right: a cached concrete-action
  // habit is not a valid answer to the new prompt.
  promptVersion: 2,
  schema: habitSuggestions,
  buildPrompt,
};
