import "server-only";

import { runGenerator } from "./harness";
import { activityProposer, type ActivityProposal } from "./activity-proposer";
import { getHabit, type HabitRow } from "@/db/habits";
import type { UserId } from "@/db/scope";
import type { Lang } from "@/lib/i18n";

// The seam for activity_proposer — same shape as suggest-habits.ts: read
// what's needed, run the generator, hand back something a screen can render.
// What's different on purpose: this NEVER writes to `config` itself — the
// caller (the onboarding activities action, or a future /config "suggest"
// button) decides what happens with a proposal; this module's job ends at
// handing back validated ones.
//
// ONE CALL PER HABIT, run in parallel — see activity-proposer.ts for why the
// old single-batched-call shape was replaced (a batch answering for only 1 of
// N habits, silently, was the actual bug this exists to fix). A known,
// accepted cost of running them in parallel rather than sequentially:
// harness.ts's daily-quota check (`runsToday(userId) >= DAILY_RUN_QUOTA`) is
// read-then-write, not atomic, so N concurrent calls can all pass the check
// before any of them is recorded — a small, bounded overshoot (bounded by
// however many habits are in one onboarding batch, typically under 10) on a
// personal-project soft cap, not a hard billing ceiling. Traded deliberately
// for one wait instead of N sequential ones, which for calls already
// measuring tens of seconds each is the difference between an onboarding step
// and a coffee break.
//
// Trigger rule, enforced by the caller, not by anything here: this only ever
// runs when a person asks for it — the onboarding activities step's
// "Generate" action, one call per still-plain habit shown.

export interface ActivityPick {
  habitId: number;
  // The per-habit briefing typed on /onboarding/activities — see
  // ActivityProposerInput's own comment (activity-proposer.ts).
  briefing: string | null;
}

export interface ProposedActivity {
  habitId: number;
  // Carried through so the caller can name a "plain" proposal after its own
  // habit without a second DB round-trip — the rich kinds still get a
  // generic default name (see activities/actions.ts's DEFAULT_NAME).
  habitName: string;
  proposal: ActivityProposal;
  // Carried through so the caller can store it as the new activity's own
  // `why` — the briefing IS the reason this specific activity was proposed,
  // same idiom `why` already carries at the habit layer.
  briefing: string | null;
}

export interface FailedActivity {
  habitId: number;
  status: "unavailable" | "invalid" | "error";
}

export type ProposeOutcome =
  | { status: "ok"; perHabit: ProposedActivity[]; failed: FailedActivity[] }
  // None of the given picks resolved to an eligible habit — nothing to run
  // the generator on at all.
  | { status: "nothing" };

interface Eligible {
  habit: HabitRow;
  briefing: string | null;
}

export async function proposeActivities(
  userId: UserId,
  picks: ActivityPick[],
  lang: Lang
): Promise<ProposeOutcome> {
  const rows = await Promise.all(picks.map((p) => getHabit(userId, p.habitId)));
  const eligible: Eligible[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const habit = rows[i];
    if (!habit) continue;
    eligible.push({ habit, briefing: picks[i].briefing });
  }
  if (eligible.length === 0) return { status: "nothing" };

  const results = await Promise.all(
    eligible.map(async ({ habit, briefing }) => {
      const outcome = await runGenerator(activityProposer, userId, {
        lang,
        habitName: habit.name,
        why: habit.why,
        briefing,
      });
      return { habit, briefing, outcome };
    })
  );

  const perHabit: ProposedActivity[] = [];
  const failed: FailedActivity[] = [];
  for (const { habit, briefing, outcome } of results) {
    if (outcome.status === "ok") {
      perHabit.push({
        habitId: habit.id,
        habitName: habit.name,
        proposal: outcome.data,
        briefing,
      });
    } else {
      failed.push({ habitId: habit.id, status: outcome.status });
    }
  }

  return { status: "ok", perHabit, failed };
}
