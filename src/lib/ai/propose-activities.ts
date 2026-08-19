import "server-only";

import { runGenerator } from "./harness";
import {
  activityProposer,
  type ActivityProposal,
  type ProposableKind,
} from "./activity-proposer";
import { getHabit, type HabitRow } from "@/db/habits";
import type { UserId } from "@/db/scope";
import type { Lang } from "@/lib/i18n";

// The seam for activity_proposer — same shape as suggest-habits.ts: read
// what's needed, run the generator once for the whole batch, hand back
// something a screen can render. What's different on purpose: this NEVER
// writes to `config` itself — the caller (the onboarding activities action,
// or a future /config "suggest" button) decides what happens with a
// proposal; this module's job ends at handing back a validated one.
//
// Trigger rule, enforced by the caller, not by anything here: this only ever
// runs when a person asks for it — the onboarding activities step's one
// "Generate" action (covering every umbrella habit shown, in one call), or a
// future natural-language `request` alongside a single habit's own "suggest"
// button. Nothing calls this unprompted.

export interface ProposedActivity {
  habitId: number;
  proposal: ActivityProposal;
}

export type ProposeOutcome =
  | { status: "ok"; perHabit: ProposedActivity[]; cached: boolean }
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "error" }
  // None of the given habit ids belonged to this account or carried a
  // proposable kind — nothing to run the generator on at all.
  | { status: "nothing" };

const PROPOSABLE_KINDS: ProposableKind[] = [
  "treino",
  "leitura",
  "rotina",
  "duolingo",
  "espiritualidade",
];

function isProposableKind(kind: string | null): kind is ProposableKind {
  return kind !== null && (PROPOSABLE_KINDS as string[]).includes(kind);
}

// Proposes activities for one or more habits in a SINGLE call — see
// activity-proposer.ts for why batching is load-bearing, not an optimization.
// Habit ids that don't belong to this account, or aren't a proposable kind,
// are silently dropped rather than failing the whole batch — the same
// per-item defensiveness suggestHabits already applies to domainSlug.
export async function proposeActivities(
  userId: UserId,
  habitIds: number[],
  lang: Lang,
  // Applies to the whole batch; see ActivityProposerInput's own comment.
  request: string | null
): Promise<ProposeOutcome> {
  const rows = await Promise.all(habitIds.map((id) => getHabit(userId, id)));
  const eligible = rows.filter(
    (h): h is HabitRow & { templateKind: ProposableKind } =>
      h !== null && isProposableKind(h.templateKind)
  );
  if (eligible.length === 0) return { status: "nothing" };

  const outcome = await runGenerator(activityProposer, userId, {
    lang,
    habits: eligible.map((h) => ({
      habitName: h.name,
      why: h.why,
      kind: h.templateKind,
    })),
    request,
  });
  if (outcome.status !== "ok") return { status: outcome.status };

  // Zipped by POSITION, not an echoed id — see activity-proposer.ts. A
  // length mismatch (the model skipped or added one) is handled by simply
  // not pairing past the shorter list, rather than failing outright: a
  // partial batch a person can still review beats discarding a real result
  // over one missing item.
  const perHabit: ProposedActivity[] = [];
  for (let i = 0; i < Math.min(eligible.length, outcome.data.perHabit.length); i += 1) {
    const habit = eligible[i];
    const proposal = outcome.data.perHabit[i];
    // The schema guarantees A valid kind, not the RIGHT one for this
    // position — guards against the model answering out of order, the same
    // shape of check suggestHabits runs on domainSlug.
    if (proposal.kind !== habit.templateKind) continue;
    perHabit.push({ habitId: habit.id, proposal });
  }

  if (perHabit.length === 0) return { status: "invalid" };
  return { status: "ok", perHabit, cached: outcome.cached };
}
