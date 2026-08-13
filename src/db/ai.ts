// Data access for the AI harness. Sibling of queries.ts and assessment.ts,
// under the same rules: branded user id first, every id-addressed write
// filtered on the user too.
//
// One table does three jobs (see the ai_runs comment in schema.ts): it is the
// record, the cache, and the quota counter. That is not overloading for its
// own sake — all three questions are asked of the same rows, and splitting
// them would mean writing the same call three times.
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "./index";
import { aiPendingRequests, aiRuns, type AiOutcome } from "./schema";
import type { UserId } from "./scope";

export interface RunRecord {
  generator: string;
  provider: string;
  model: string;
  outcome: AiOutcome;
  latencyMs: number;
  attempt: number;
  inputHash: string;
  cached?: boolean;
  output?: unknown;
  error?: string | null;
}

// How long a cached answer stays good. Long enough that pressing Generate
// twice, or reloading the review screen, costs nothing; short enough that
// editing a direction and coming back produces a fresh suggestion — though
// that case is already covered, since the direction text is part of the hash.
const CACHE_TTL_HOURS = 24;

// A day's worth of real (uncached) calls per person. Generous for the intended
// use — you generate habits once a cycle — and low enough that a loop in a
// client component can't run up a bill overnight.
export const DAILY_RUN_QUOTA = 20;

// One row per attempt. A rotation from one provider to the next is two rows
// with the same input_hash and attempt 1, 2 — which is what makes "did the
// failover work?" a query rather than a log grep.
export async function recordRun(
  userId: UserId,
  run: RunRecord
): Promise<void> {
  await db.insert(aiRuns).values({
    userId,
    generator: run.generator,
    provider: run.provider,
    model: run.model,
    outcome: run.outcome,
    latencyMs: run.latencyMs,
    attempt: run.attempt,
    inputHash: run.inputHash,
    cached: run.cached ?? false,
    output: run.output ?? null,
    // Truncated, and never the prompt or the key — see the harness.
    error: run.error ? run.error.slice(0, 500) : null,
  });
}

// The newest good answer for this exact input, inside the TTL.
export async function findCachedRun(
  userId: UserId,
  generator: string,
  inputHash: string
): Promise<{ output: unknown; provider: string; model: string } | null> {
  const since = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000);
  const [row] = await db
    .select({
      output: aiRuns.output,
      provider: aiRuns.provider,
      model: aiRuns.model,
    })
    .from(aiRuns)
    .where(
      and(
        eq(aiRuns.userId, userId),
        eq(aiRuns.generator, generator),
        eq(aiRuns.inputHash, inputHash),
        eq(aiRuns.outcome, "ok"),
        gte(aiRuns.createdAt, since)
      )
    )
    .orderBy(desc(aiRuns.createdAt))
    .limit(1);
  return row?.output ? { ...row, output: row.output } : null;
}

// Calls that actually cost money today. Cached hits are excluded because they
// never reached a provider.
//
// Durable, unlike the in-memory login limiter this deliberately does not
// share a mechanism with: a serverless cold start cannot reset a table.
export async function runsToday(userId: UserId): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(aiRuns)
    .where(
      and(
        eq(aiRuns.userId, userId),
        eq(aiRuns.cached, false),
        gte(aiRuns.createdAt, startOfDay)
      )
    );
  return row?.n ?? 0;
}

// What was PROPOSED on the most recent successful run — the denominator for
// the rejection rate, since the habits table only records what was kept.
export async function lastProposal(
  userId: UserId,
  generator: string
): Promise<unknown | null> {
  const [row] = await db
    .select({ output: aiRuns.output })
    .from(aiRuns)
    .where(
      and(
        eq(aiRuns.userId, userId),
        eq(aiRuns.generator, generator),
        eq(aiRuns.outcome, "ok")
      )
    )
    .orderBy(desc(aiRuns.createdAt))
    .limit(1);
  return row?.output ?? null;
}

// ─── The "will regenerate later" fallback ────────────────────────────────────

// Written only when every provider failed. Rare by construction — it takes all
// three being down at once.
export async function recordPendingRequest(
  userId: UserId,
  generator: string,
  input: unknown
): Promise<void> {
  // One open request per user per generator is enough; a second failure while
  // one is already outstanding is the same request, not a new one.
  const existing = await findPendingRequest(userId, generator);
  if (existing) return;
  await db.insert(aiPendingRequests).values({ userId, generator, input });
}

export async function findPendingRequest(
  userId: UserId,
  generator: string
): Promise<{ id: number; input: unknown } | null> {
  const [row] = await db
    .select({ id: aiPendingRequests.id, input: aiPendingRequests.input })
    .from(aiPendingRequests)
    .where(
      and(
        eq(aiPendingRequests.userId, userId),
        eq(aiPendingRequests.generator, generator),
        isNull(aiPendingRequests.resolvedAt)
      )
    )
    .limit(1);
  return row ?? null;
}

// Resolved when a retry succeeds OR when the user finishes the job by hand.
// The second case matters: once someone has accepted a set of habits, quietly
// regenerating over them later would undo work they thought was done.
export async function resolvePendingRequest(
  userId: UserId,
  generator: string
): Promise<void> {
  await db
    .update(aiPendingRequests)
    .set({ resolvedAt: new Date() })
    .where(
      and(
        eq(aiPendingRequests.userId, userId),
        eq(aiPendingRequests.generator, generator),
        isNull(aiPendingRequests.resolvedAt)
      )
    );
}
