import "server-only";

import { runGenerator } from "./harness";
import {
  activityProposer,
  type ActivityProposal,
  type ProposableKind,
} from "./activity-proposer";
import { getHabit } from "@/db/habits";
import type { UserId } from "@/db/scope";
import type { Lang } from "@/lib/i18n";

// The seam for the one new generator this phase adds — same shape as
// suggest-habits.ts: read what's needed, run the generator, hand back
// something a screen can render. What's different on purpose: this NEVER
// writes to `config`. A proposal here is a draft that prefills the same
// /config form a person would fill by hand (WorkoutStep, ReadingStep, ...)
// — pressing that form's own Save button is still the only way anything
// persists, so "proposal until touched" falls out of reusing the existing
// write path rather than needing a second one.
//
// Trigger rule, enforced by the caller, not by anything here: this only ever
// runs when a person asks for it — a "suggest" action on a rich habit, or a
// natural-language `request` alongside one. Nothing calls this unprompted.

export type ProposeOutcome =
  | { status: "ok"; data: ActivityProposal; cached: boolean }
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "error" }
  // The habit doesn't belong to this account, or isn't one of the five kinds
  // this generator knows how to propose for (sleep and hobby need no list;
  // the five card-style kinds have no rich shape to propose into).
  | { status: "not_proposable" };

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

export async function proposeActivities(
  userId: UserId,
  habitId: number,
  lang: Lang,
  // Present for the natural-language form ("recommend me 5 fiction books");
  // null for the plain "suggest" action, which works from the habit alone.
  request: string | null
): Promise<ProposeOutcome> {
  const habit = await getHabit(userId, habitId);
  if (!habit || !isProposableKind(habit.templateKind)) {
    return { status: "not_proposable" };
  }

  const outcome = await runGenerator(activityProposer, userId, {
    lang,
    habitName: habit.name,
    why: habit.why,
    kind: habit.templateKind,
    request,
  });
  if (outcome.status !== "ok") return { status: outcome.status };

  // The schema guarantees a valid kind, not the RIGHT one — this guards
  // against a model answering for a different domain than it was asked
  // about, the same shape of check suggestHabits runs on domainSlug.
  if (outcome.data.kind !== habit.templateKind) return { status: "invalid" };

  return { status: "ok", data: outcome.data, cached: outcome.cached };
}
