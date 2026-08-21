import { describe, expect, test } from "bun:test";
import { habitSuggester, type SuggesterInput } from "./habit-suggester";

// habit_suggester's prompt now asks for UMBRELLA habits — general enough to
// hold several activities later, specific enough to act on, never the area's
// own name back and never a single dated gesture. That's a granularity claim
// no static read of the prompt can confirm; it can only be checked against
// what a real model actually returns. Two tiers here:
//
//   1. Prompt construction — deterministic, always runs. Confirms the prompt
//      actually ASKS for the right thing (domain context included, the 1–2
//      count, no leftover "2–3" wording).
//   2. A real generation — gated behind a configured provider key AND
//      DATABASE_URL (runGenerator writes to ai_runs), same convention as
//      every other live-gated test in this app. Runs the actual prompt
//      against a real provider and checks the output for the two concrete
//      failure modes the prompt names: collapsing into the raw domain name,
//      or collapsing into an over-specific single gesture. Heuristic, not
//      proof of "correct" granularity — but a real, automatable signal
//      instead of just trusting the prompt reads well.

describe("buildPrompt — deterministic", () => {
  const input: SuggesterInput = {
    lang: "en",
    areas: [
      {
        domainSlug: "health",
        domainName: "Health",
        domainDescription: "Your body and how you look after it.",
        domainBoundary: "The care itself, not how you look.",
        narrative: "Move my body most days without it feeling like a chore.",
        rawReflection: "",
        findings: [],
      },
    ],
  };
  const { system, prompt } = habitSuggester.buildPrompt(input);

  test("asks for 1-2 habits per area, not 2-3", () => {
    expect(system).toContain("1 or 2 umbrella habits");
    expect(prompt).toContain("Propose 1–2 umbrella habits");
    expect(system).not.toContain("2 or 3");
    expect(prompt).not.toContain("2–3 daily habits");
  });

  test("names both umbrella failure modes explicitly", () => {
    expect(system).toContain("naming the area back");
    expect(system).toContain("naming one specific gesture");
  });

  test("includes the domain's description and boundary, not just its name", () => {
    expect(prompt).toContain("Your body and how you look after it.");
    expect(prompt).toContain("The care itself, not how you look.");
  });
});

// ─── Live: does a real model actually land at umbrella granularity? ─────────
//
// Calls the model directly with this generator's real schema/prompt — NOT
// through runGenerator/providers.ts, which are both `server-only`-guarded
// (that guard's real implementation throws unconditionally outside Next's
// own bundler, so a guarded module can never be imported by plain `bun
// test`; see src/lib/session-resolve.ts for the same constraint solved the
// same way). habit-suggester.ts itself carries no I/O and no guard, so its
// exported schema/prompt are safe to exercise directly here. This test is
// about prompt/schema quality, not harness plumbing (caching, rotation,
// ai_runs recording) — those are generic across every generator and are
// exercised structurally elsewhere; nothing about them is specific to
// umbrella-granularity, which is the one thing only a real call can show.

const LIVE = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

// A weekday or clock-time token anywhere in the name is a strong signal the
// model produced an ACTIVITY ("Monday run at 6pm"), not an umbrella.
const OVER_SPECIFIC = new RegExp(
  "\\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|" +
    "segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)\\b|" +
    "\\d{1,2}(:\\d{2})?\\s*(am|pm|h)\\b",
  "i"
);

// Four distinct areas, four distinct voices/situations — the "§7 rule"
// (POST-REBUILD-feedback-and-plan.md) this generator's granularity claim was
// named against: it can only be validated across several different
// situations, not just one area or one person's own phrasing. Sent in ONE
// batched call, matching how suggest-habits.ts actually calls this generator
// in production (every priority area together, never one at a time) — so
// this is both more representative and cheaper than four separate live
// calls.
const FOUR_AREA_INPUT: SuggesterInput = {
  lang: "en",
  areas: [
    {
      domainSlug: "health",
      domainName: "Health",
      domainDescription: "Your body and how you look after it. Sleep, movement, food, medical care.",
      domainBoundary: "The care itself, not how you look.",
      narrative: "Move my body most days without it feeling like a chore.",
      rawReflection:
        "I used to run in college and felt strong. Now I sit all day for work and " +
        "barely move. I don't need a race to train for, I just want movement to be " +
        "a normal part of my day again, not a special event I have to plan around.",
      findings: [],
    },
    {
      domainSlug: "education",
      domainName: "Education",
      domainDescription: "Learning something on purpose, inside or outside a classroom.",
      domainBoundary: "Deliberate learning, not passive scrolling.",
      narrative: "Read real books again instead of just headlines.",
      rawReflection:
        "I have a shelf of books I bought meaning to read and never touched. My " +
        "attention span for anything longer than a tweet has gotten worse over " +
        "the last few years and it bothers me.",
      findings: [],
    },
    {
      domainSlug: "family",
      domainName: "Family",
      domainDescription: "The people you're related to, and the relationships you keep with them.",
      domainBoundary: "Family specifically, not friendships in general.",
      narrative: "Actually talk to my parents instead of a yearly holiday call.",
      rawReflection:
        "We live in different cities now and weeks go by without a real " +
        "conversation. Everyone says they're busy. I don't want us to become " +
        "people who only talk at funerals.",
      findings: [],
    },
    {
      domainSlug: "spirituality",
      domainName: "Spirituality",
      domainDescription: "Whatever practice connects you to something larger than the everyday.",
      domainBoundary: "The practice itself, not organised religion as an institution.",
      narrative: "A short daily practice that isn't just checking a box.",
      rawReflection:
        "I grew up going to church and stopped somewhere in my twenties without " +
        "really deciding to. I miss having a quiet moment in the day that isn't " +
        "about being productive.",
      findings: [],
    },
  ],
};

describe.skipIf(!LIVE)("habit_suggester — real generation", () => {
  // A real model call. The harness's own docs put this generator at 5-20s
  // normally; gemini-3.6-flash measured ~48s for this schema in practice
  // (see providers.ts's comment) — well past that, and four areas in one
  // call is more work than the single-area case this timeout was originally
  // set from, so it's generous here too.
  test("proposes umbrella habits for every area, none the domain name or a specific gesture", async () => {
    const { generateObject } = await import("ai");
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    const model = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    })("gemini-3.6-flash"); // keep in sync with src/lib/ai/providers.ts

    const { system, prompt } = habitSuggester.buildPrompt(FOUR_AREA_INPUT);

    const { object } = await generateObject({
      model,
      schema: habitSuggester.schema,
      system,
      prompt,
    });

    for (const { domainSlug, domainName } of FOUR_AREA_INPUT.areas) {
      const area = object.perArea.find((a) => a.domainSlug === domainSlug);
      expect(area).toBeDefined();
      expect(area!.habits.length).toBeGreaterThanOrEqual(1);
      expect(area!.habits.length).toBeLessThanOrEqual(2);

      for (const habit of area!.habits) {
        const name = habit.name.trim();
        // Not the raw domain name back.
        expect(name.toLowerCase()).not.toBe(domainName.toLowerCase());
        // Not an over-specific single gesture.
        expect(OVER_SPECIFIC.test(name)).toBe(false);
        // An umbrella reads as a short phrase, not a sentence.
        expect(name.split(/\s+/).length).toBeLessThanOrEqual(6);
        // Every proposal stays the generic renderer — never a rich kind.
        expect(habit.templateKind).toBe("plain");
      }
    }
  }, 120000);
});
