// The single source of truth for "where does this account belong right now"
// across the whole first-run chain (values grid -> results -> directions ->
// areas -> AI habits -> habits review). Two places read it: the (app) gate,
// which redirects here whenever an account has no active habit yet, and the
// chain's own entry point (/onboarding), which redirects away from the
// "Start" screen the moment there's real state to resume into instead.
//
// Deliberately not backed by a stored flag. `users.first_run_step` already
// exists and could in principle be repurposed, but it's write-only churn
// telemetry with a coarser vocabulary than this needs — it can't tell
// "habits proposed, deciding" from "generation failed, retriable" from
// "started tracking" apart, three states this function tells apart by
// reading the real rows. That's the same principle the (app) gate itself was
// already built on ("completion is derived from the database, not a
// cookie"), applied one level deeper, to every step inside it.
import { getLatestSealed, getOpenDraft, listDirectionNarratives } from "@/db/assessment";
import { findPendingRequest } from "@/db/ai";
import { countTrackedHabits, listProposedHabits } from "@/db/habits";
import type { UserId } from "@/db/scope";
import { firstUnanswered, firstUndirected } from "./assessment";
import { isDomainSlug, type DomainSlug } from "./domains";

export type OnboardingStep =
  | { screen: "intro" }
  | { screen: "grid"; slug: DomainSlug }
  | { screen: "results" }
  | { screen: "directions"; slug: DomainSlug }
  | { screen: "areas" }
  | { screen: "habits" };

export async function resolveOnboardingStep(
  userId: UserId
): Promise<OnboardingStep> {
  const draft = await getOpenDraft(userId);
  if (draft) {
    const next = firstUnanswered(draft.ratings);
    return next ? { screen: "grid", slug: next } : { screen: "results" };
  }

  const sealed = await getLatestSealed(userId);
  if (!sealed) return { screen: "intro" };

  const priority = sealed.priorityDomains.filter(isDomainSlug);
  // Nothing to prioritize is a real answer, not a lesser one — but nothing
  // downstream (directions, areas) has anything to do with an empty list, so
  // skip straight to the one screen that still works there: add habits by
  // hand. See the matching branch in habits/page.tsx and results/page.tsx.
  if (priority.length === 0) return { screen: "habits" };

  const written = await listDirectionNarratives(userId, sealed.cycleId);
  // P4: results must sit between sealing and directions, not be skipped
  // entirely — the resolver used to fall straight from `sealed` to checking
  // `missing` below, so the very first redirect after the 12th area landed
  // on directions with results never shown at all. Zero directions written
  // yet is the derived "hasn't seen results" signal (no new column, matching
  // this function's own principle) — self-clearing the moment one is saved,
  // so a resumed walk goes straight back into directions rather than being
  // bounced through results on every visit.
  if (Object.keys(written).length === 0) return { screen: "results" };
  const missing = firstUndirected(priority, written);
  if (missing) return { screen: "directions", slug: missing };

  const proposed = await listProposedHabits(userId);
  if (proposed.length > 0) return { screen: "habits" };

  // A failed generation leaves a retriable row behind. Routing to "areas"
  // would still work eventually (its Generate button redirects back here
  // with ?generate=1) but costs a click undoing the silent-retry property
  // the habits screen already has on its own — landing here directly
  // preserves that.
  const pending = await findPendingRequest(userId, "habit_suggester");
  if (pending) return { screen: "habits" };

  return { screen: "areas" };
}

export function onboardingStepHref(step: OnboardingStep): string {
  switch (step.screen) {
    case "intro":
      return "/onboarding";
    case "grid":
      return `/onboarding?step=${step.slug}`;
    case "results":
      return "/onboarding/results";
    case "directions":
      return `/onboarding/directions?domain=${step.slug}`;
    case "areas":
      return "/onboarding/areas";
    case "habits":
      return "/onboarding/habits";
  }
}

// The exact predicate the (app) gate already runs, named and exposed once so
// nothing re-derives "is this a first-run account" slightly differently.
export async function isFirstRun(userId: UserId): Promise<boolean> {
  return (await countTrackedHabits(userId)) === 0;
}
