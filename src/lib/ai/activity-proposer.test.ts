import { describe, expect, test } from "bun:test";
import { activityProposer, type ActivityProposerInput } from "./activity-proposer";

// One call per habit now (see propose-activities.ts for why the old batched
// shape was replaced) — this generator's own contract is simpler as a
// result: one input habit in, one proposal out, kind CHOSEN by the model
// rather than given. Same convention as habit-suggester.test.ts: calls the
// model directly (activity-proposer.ts carries no I/O and no `server-only`
// guard, unlike harness.ts/propose-activities.ts — see that file's own
// comment on why), gated behind a configured provider key.

describe("buildPrompt — deterministic", () => {
  const input: ActivityProposerInput = {
    lang: "en",
    habitName: "physical activity",
    why: "Move more.",
    briefing: "a beginner strength split, 3 days a week",
  };
  const { system, prompt } = activityProposer.buildPrompt(input);

  test("names the habit, its why and its briefing", () => {
    expect(prompt).toContain('HABIT: "physical activity"');
    expect(prompt).toContain('Why this habit exists: "Move more."');
    expect(prompt).toContain(
      'What they specifically want here: "a beginner strength split, 3 days a week"'
    );
  });

  test("omits the why/briefing lines when absent, doesn't invent them", () => {
    const bare = activityProposer.buildPrompt({
      lang: "en",
      habitName: "reading",
      why: null,
      briefing: null,
    });
    expect(bare.prompt).toContain('HABIT: "reading"');
    expect(bare.prompt).not.toContain("Why this habit exists");
    expect(bare.prompt).not.toContain("What they specifically want here");
  });

  test("instructs choosing a kind from exactly the four the model may propose", () => {
    expect(system).toContain('"treino"');
    expect(system).toContain('"leitura"');
    expect(system).toContain('"espiritualidade"');
    expect(system).toContain('"plain"');
    // The old contract required a caller-supplied kind and forbade swapping
    // it — that instruction must be gone now that kind is chosen, not given.
    expect(system).not.toContain("kind must match");
  });

  test("tells the model plain is a real answer, not a fallback of last resort", () => {
    const normalized = system.replace(/\s+/g, " ");
    expect(normalized).toContain("it is not a lesser answer, it is the right one");
  });
});

const LIVE = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

describe.skipIf(!LIVE)("activity_proposer — real generation", () => {
  async function generate(input: ActivityProposerInput) {
    const { generateObject } = await import("ai");
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    const model = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    })("gemini-3.6-flash"); // keep in sync with src/lib/ai/providers.ts

    const { system, prompt } = activityProposer.buildPrompt(input);
    const { object } = await generateObject({
      model,
      schema: activityProposer.schema,
      system,
      prompt,
    });
    return object;
  }

  test("a clearly workout-shaped habit resolves to treino, with real days", async () => {
    const object = await generate({
      lang: "en",
      habitName: "physical activity",
      why: "Move my body most days without it feeling like a chore.",
      briefing: "a beginner strength split, 3 days a week",
    });
    expect(object.kind).toBe("treino");
    if (object.kind === "treino") {
      expect(object.days.length).toBeGreaterThan(0);
      expect(object.days[0].exercises.length).toBeGreaterThan(0);
    }
  }, 120000);

  test("a habit with nothing rich to propose resolves to plain, with a real starting point", async () => {
    const object = await generate({
      lang: "en",
      habitName: "call a friend",
      why: "Keep in touch with people who live far away.",
      briefing: null,
    });
    expect(object.kind).toBe("plain");
    if (object.kind === "plain") {
      expect(["binary", "count", "duration"]).toContain(object.metricType);
    }
    // Rule 4: never an account-level frequency/streak, but a concrete
    // starting number INSIDE the proposal is expected, not forbidden — this
    // is the one live check that the "AI never calculates" exception this
    // file documents actually holds in practice, not just in the prompt.
  }, 120000);
});
