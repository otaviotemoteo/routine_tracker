import "server-only";

import { runGenerator } from "./harness";
import { habitSuggester, type SuggesterInput } from "./habit-suggester";
import { resolvePendingRequest } from "@/db/ai";
import { getLatestSealed, listDirectionNarratives } from "@/db/assessment";
import {
  clearProposedHabits,
  writeProposedHabits,
  type HabitInput,
} from "@/db/habits";
import type { UserId } from "@/db/scope";
import { buildingAreas } from "@/lib/assessment";
import { diagnose } from "@/lib/diagnose";
import { isDomainSlug, type DomainSlug } from "@/lib/domains";
import { ASSESSMENT_COPY } from "@/lib/i18n-assessment";
import type { Lang } from "@/lib/i18n";

// The seam between the values layer and the habits layer.
//
// The harness knows how to call a model safely and the generator knows what to
// ask for; neither knows anything about assessments or habits. This module is
// where those meet: it reads what someone wrote, runs the generator, and turns
// the answer into rows. Keeping it separate is what lets the harness be
// swapped, or deleted, without touching a screen.

export type SuggestOutcome =
  | { status: "ok"; written: number }
  // No key, or today's quota is spent. Decided before any I/O.
  | { status: "unavailable" }
  // A provider answered in the wrong shape, or every provider failed. Both
  // land on the same screen; they are kept apart because ai_runs records the
  // difference and the two mean very different things to whoever is debugging.
  | { status: "invalid" }
  | { status: "error" }
  // Nothing to work from: no sealed assessment, or no direction written yet.
  | { status: "nothing" };

// Everything the prompt sees, assembled in one place so it is reviewable as a
// single object rather than as string concatenation spread across a call.
async function buildInput(
  userId: UserId,
  lang: Lang
): Promise<{ input: SuggesterInput; areas: Set<DomainSlug> } | null> {
  const sealed = await getLatestSealed(userId);
  if (!sealed) return null;

  const written = await listDirectionNarratives(userId, sealed.cycleId);
  const building = buildingAreas(
    sealed.priorityDomains.filter(isDomainSlug),
    written
  );

  // The engine is pure and cheap, so the findings are recomputed here rather
  // than stored. Only the frozen priority cut is ever read back from a column.
  const findings = diagnose(sealed.ratings);

  const areas = building
    .filter((slug) => written[slug]?.narrative?.trim())
    .map((slug) => ({
      domainSlug: slug,
      // English names regardless of the UI language: the prompt is written in
      // English, and the answer's language is set separately. A Portuguese
      // label inside an English instruction reads as a typo to a model.
      domainName: ASSESSMENT_COPY.en.domains[slug].name,
      narrative: written[slug].narrative.trim(),
      rawReflection: written[slug].rawReflection.trim(),
      findings: findings.filter((f) => f.domainSlug === slug),
    }));

  // An area with no direction is nothing to write from. Suggesting habits off
  // the ratings alone would be the machine inventing what someone meant.
  if (areas.length === 0) return null;

  return {
    input: { lang, areas },
    areas: new Set(areas.map((a) => a.domainSlug)),
  };
}

// Generate a set of habits and persist them as proposals.
//
// The rows are written with `active_from = NULL`, which means they exist but
// no user-facing read can see them (src/db/scope.ts). That is the decision
// that makes the review screen survive a refresh: this is a 5–20 second call
// that costs a quota unit on a phone-first app, and holding the result in
// client state would lose the whole set to a backgrounded tab.
//
// Never throws — every failure is one of the outcomes above, and each renders
// the same manual path.
export async function suggestHabits(
  userId: UserId,
  lang: Lang
): Promise<SuggestOutcome> {
  const built = await buildInput(userId, lang);
  if (!built) return { status: "nothing" };

  const outcome = await runGenerator(habitSuggester, userId, built.input);
  if (outcome.status !== "ok") return { status: outcome.status };

  const inputs: HabitInput[] = [];
  for (const area of outcome.data.perArea) {
    // The schema guarantees a valid domain slug; this guards against a model
    // answering for an area nobody asked about. A habit anchored to an area
    // the person did not choose is a habit they will not recognise.
    if (!built.areas.has(area.domainSlug)) continue;

    for (const habit of area.habits) {
      inputs.push({
        name: habit.name,
        domainSlug: area.domainSlug,
        metricType: habit.metricType,
        // A binary habit counts nothing, so a stray unit would render as a
        // label on a figure that does not exist.
        unit: habit.metricType === "binary" ? null : (habit.unit ?? null),
        // Always null. "AI never calculates" — the target is a form field the
        // human fills, and the schema has no numeric field to carry one.
        target: null,
        minimalAction: habit.minimalAction,
        // Enum-constrained to 'plain' this phase; see src/lib/templates.ts.
        templateKind: habit.templateKind,
        why: habit.why,
      });
    }
  }

  if (inputs.length === 0) return { status: "invalid" };

  // Replace rather than stack. A second generation — a retry after an outage,
  // or a re-press — must not leave the first attempt's habits sitting
  // alongside the second's.
  await clearProposedHabits(userId);
  const written = await writeProposedHabits(userId, inputs);

  // A request left behind by an earlier outage has now been answered, so it
  // stops being retried on every visit. The other way it gets resolved is the
  // user writing habits by hand and pressing Start tracking — see
  // src/app/(app)/habits/actions.ts.
  await resolvePendingRequest(userId, habitSuggester.name);

  return { status: "ok", written };
}
