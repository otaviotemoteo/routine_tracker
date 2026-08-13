import "server-only";

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { generateObject } from "ai";
import type { z } from "zod";
import { providers } from "./providers";
import {
  DAILY_RUN_QUOTA,
  findCachedRun,
  recordPendingRequest,
  recordRun,
  runsToday,
} from "@/db/ai";
import type { UserId } from "@/db/scope";

// The AI harness.
//
// Everything a generator needs to run safely sits here, so a generator itself
// is only a schema, a prompt and a name. That is deliberate: the AI is the
// thinnest and most replaceable layer in this app, and it should be possible
// to swap a provider, add a fourth, or delete the whole thing without touching
// the data model or a single screen.
//
// The contract that makes that true: runGenerator NEVER THROWS. Every failure
// — no key, no quota, a network error, a malformed answer — comes back as one
// of four outcomes, and every non-ok outcome renders the same manual path.
// A failed model call must never be able to strand somebody mid-flow.

export type RunOutcome<T> =
  | { status: "ok"; data: T; provider: string; cached: boolean }
  // Decided BEFORE any I/O: no provider has a key, or today's quota is spent.
  // This is what lets a screen omit the Generate button entirely rather than
  // showing one that fails when pressed.
  | { status: "unavailable" }
  // A provider answered, but not in the shape the schema demands.
  | { status: "invalid" }
  // Every configured provider failed to answer at all.
  | { status: "error" };

export interface Generator<TInput, TOutput> {
  name: string;
  // Bumping this invalidates every cached answer for the generator, which is
  // what you want when the prompt changes: the same input should not return
  // yesterday's wording from a prompt that no longer exists.
  promptVersion: number;
  schema: z.ZodType<TOutput>;
  buildPrompt: (input: TInput) => { system: string; prompt: string };
}

// The cache key. Includes the prompt version, so editing a prompt is enough to
// stop serving answers produced by the old one.
function hashInput(
  generator: string,
  promptVersion: number,
  input: unknown
): string {
  return createHash("sha256")
    .update(`${generator}:${promptVersion}:${JSON.stringify(input)}`)
    .digest("hex");
}

// What may be written to ai_runs.error.
//
// Never the prompt (it contains someone's directions, which are the most
// personal text in the app) and never a key. Provider SDKs sometimes put the
// request — headers included — into the error message, so the message is
// truncated hard and anything that looks like a key is stripped.
function scrubError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/(?:sk|gsk|AIza)[A-Za-z0-9_\-]{10,}/g, "[key]")
    .replace(/Bearer\s+\S+/gi, "Bearer [key]")
    .slice(0, 300);
}

// A provider failing to answer, versus answering with the wrong shape. The
// distinction drives the single most important rule in this file.
function isSchemaFailure(err: unknown): boolean {
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);
  return (
    name === "AI_NoObjectGeneratedError" ||
    name === "AI_TypeValidationError" ||
    name === "ZodError" ||
    /schema|validation|could not parse|no object generated/i.test(message)
  );
}

export async function runGenerator<TInput, TOutput>(
  generator: Generator<TInput, TOutput>,
  userId: UserId,
  input: TInput
): Promise<RunOutcome<TOutput>> {
  const inputHash = hashInput(
    generator.name,
    generator.promptVersion,
    input
  );
  const available = providers().filter((p) => p.resolve !== null);

  // ── Unavailable, decided before any I/O ────────────────────────────────
  if (available.length === 0) return { status: "unavailable" };

  // The durable per-user daily cap. Unlike the login limiter this replaces,
  // a serverless cold start cannot reset it — it is a count of rows.
  if ((await runsToday(userId)) >= DAILY_RUN_QUOTA) {
    return { status: "unavailable" };
  }

  // ── Cache ──────────────────────────────────────────────────────────────
  // Re-pressing Generate, or reloading the review screen, costs nothing. This
  // is what makes the review screen's refresh-is-free property true.
  const cached = await findCachedRun(userId, generator.name, inputHash);
  if (cached) {
    const parsed = generator.schema.safeParse(cached.output);
    if (parsed.success) {
      await recordRun(userId, {
        generator: generator.name,
        provider: cached.provider,
        model: cached.model,
        outcome: "ok",
        latencyMs: 0,
        attempt: 1,
        inputHash,
        cached: true,
        output: cached.output,
      });
      return {
        status: "ok",
        data: parsed.data,
        provider: cached.provider,
        cached: true,
      };
    }
    // A cached answer that no longer fits the schema means the schema moved
    // without the prompt version being bumped. Fall through and call for real.
  }

  const { system, prompt } = generator.buildPrompt(input);

  // ── The rotation ───────────────────────────────────────────────────────
  for (const [index, provider] of available.entries()) {
    const attempt = index + 1;
    const startedAt = Date.now();
    try {
      const { object } = await generateObject({
        model: provider.resolve!(),
        schema: generator.schema,
        system,
        prompt,
      });

      await recordRun(userId, {
        generator: generator.name,
        provider: provider.id,
        model: provider.model,
        outcome: "ok",
        latencyMs: Date.now() - startedAt,
        attempt,
        inputHash,
        output: object,
      });
      return {
        status: "ok",
        data: object as TOutput,
        provider: provider.id,
        cached: false,
      };
    } catch (err) {
      const schemaFailure = isSchemaFailure(err);
      await recordRun(userId, {
        generator: generator.name,
        provider: provider.id,
        model: provider.model,
        outcome: schemaFailure ? "invalid" : "error",
        latencyMs: Date.now() - startedAt,
        attempt,
        inputHash,
        error: scrubError(err),
      });

      // A BREADCRUMB, NOT AN EXCEPTION.
      //
      // A provider being down is an expected outcome of this design — it is
      // the reason there are three of them — and it is already recorded in
      // ai_runs, which is the better place to ask about it. Reporting it as an
      // error would page somebody for somebody else's outage, and an alert
      // that fires on a working failover trains you to ignore alerts.
      //
      // It is still worth attaching, so that IF a later error is reported in
      // the same request, the trail shows which providers had already failed.
      // The scrubbed message only — never the prompt.
      Sentry.addBreadcrumb({
        category: "ai",
        level: "info",
        message: `${generator.name}: ${provider.id} ${
          schemaFailure ? "invalid" : "error"
        }`,
        data: { attempt, provider: provider.id, model: provider.model },
      });

      // THE RULE THAT MAKES THE ROTATION WORTH HAVING:
      //
      // Rotate on `error` — the provider was unreachable, slow, rate-limited
      // or broken, and a different vendor genuinely might not be.
      //
      // Do NOT rotate on `invalid`. A malformed answer means the PROMPT is
      // wrong, or the schema asks for something no model can produce. Every
      // other provider will fail the same way, so trying them just spends
      // two more calls to arrive at the same place — and hides the real fault
      // behind a rotation that looks like an outage.
      if (schemaFailure) return { status: "invalid" };
    }
  }

  // Every provider failed. Persist the request so it can be retried later, and
  // let the caller fall through to the manual form.
  await recordPendingRequest(userId, generator.name, input);
  return { status: "error" };
}

// Whether the harness could run at all right now, without running it. Screens
// use this to decide between "Generate habits" and "Add habits manually" —
// the button is absent rather than present-and-failing.
export async function canGenerate(userId: UserId): Promise<boolean> {
  if (providers().every((p) => p.resolve === null)) return false;
  return (await runsToday(userId)) < DAILY_RUN_QUOTA;
}
