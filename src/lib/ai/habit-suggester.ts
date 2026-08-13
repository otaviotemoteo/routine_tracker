import { z } from "zod";
import type { Generator } from "./harness";
import { SUGGESTABLE_TEMPLATE_KINDS } from "@/lib/templates";
import { DOMAIN_SLUGS, type DomainSlug } from "@/lib/domains";
import type { Finding, Pattern } from "@/lib/diagnose";
import type { Lang } from "@/lib/i18n";

// HabitSuggester — the first generator, taken all the way through.
//
// Input: the areas someone prioritised, what they wrote about each, and what
// the diagnostic engine found there. Output: two or three candidate habits per
// area, which a human then edits, removes or accepts.

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
      .describe("Short habit name, e.g. 'Call my parents'"),
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
    // One member this phase. The seven rich renderers read per-domain tables
    // that only the owner has rows in, so any other value would draw a broken
    // card for a new account. See src/lib/templates.ts.
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
            habits: z.array(suggestion).min(2).max(3),
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
      "not invent a difficulty they did not describe.";
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

const SYSTEM = `You help someone turn what they wrote about their own life into small daily habits.

Rules, in order of importance:

1. Propose habits that serve what THEY wrote. Their own words are the brief.
   Never propose a generic self-improvement habit that ignores them.
2. Small enough to do on a bad day. A habit nobody keeps is worth nothing, and
   this app is judged on whether people are still using it in week three.
3. Never diagnose, never grade, never praise. The numbers you are shown are
   self-reported answers, not measurements of a person. Do not infer a mood,
   do not call anything a failure, and do not congratulate.
4. Do not calculate. Never state a frequency, a target, a streak or any
   number. The person sets those themselves.
5. If an area has no findings, that is normal. Work from what they wrote.

For each area give 2 or 3 habits. Fewer, better habits beat a long list.
'why' is one line saying how the habit serves what they wrote — quote their
language where you can, so they recognise it as theirs.`;

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

Propose 2–3 daily habits for each area, using the slug given for each.`,
  };
}

export const habitSuggester: Generator<SuggesterInput, HabitSuggestions> = {
  name: "habit_suggester",
  // Bump when the prompt or the schema changes — it invalidates the cache, so
  // the same input can't return wording produced by a prompt that is gone.
  promptVersion: 1,
  schema: habitSuggestions,
  buildPrompt,
};
