import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

// The ONLY module that reads a provider key.
//
// `server-only` makes importing this from a Client Component a build error
// rather than a runtime surprise, which is the guarantee that matters: a key
// that reaches a client bundle is a key that has been published.
//
// The order is the rotation order. Because every provider sits behind the
// harness, changing this list — reordering it, dropping one, adding a fourth —
// is a change to this file alone. Nothing in the schema, the prompt, the
// database or any screen knows which one answered.

export interface Provider {
  id: string;
  model: string;
  // Absent when the key isn't set, which is what lets the harness decide
  // "unavailable" before any I/O happens.
  resolve: (() => LanguageModel) | null;
}

function key(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

// Gemini first for its free allowance, Groq second because it is fast and
// generous, OpenAI third as the one most likely to be up when the other two
// are not. Three independent vendors, so a single outage can't take all of
// them — which is the entire point of having more than one.
export function providers(): Provider[] {
  const google = key("GOOGLE_GENERATIVE_AI_API_KEY");
  const groq = key("GROQ_API_KEY");
  const openai = key("OPENAI_API_KEY");

  return [
    {
      id: "google",
      model: "gemini-2.0-flash",
      resolve: google
        ? () => createGoogleGenerativeAI({ apiKey: google })("gemini-2.0-flash")
        : null,
    },
    {
      id: "groq",
      model: "llama-3.3-70b-versatile",
      resolve: groq
        ? () => createGroq({ apiKey: groq })("llama-3.3-70b-versatile")
        : null,
    },
    {
      id: "openai",
      model: "gpt-4o-mini",
      resolve: openai
        ? () => createOpenAI({ apiKey: openai })("gpt-4o-mini")
        : null,
    },
  ];
}

// Whether any provider could answer at all. Read before any I/O, so a screen
// with no keys configured renders the manual path rather than a button that
// fails when pressed.
export function anyProviderConfigured(): boolean {
  return providers().some((p) => p.resolve !== null);
}
