"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  discardDraft,
  getDomainIds,
  getOpenDraft,
  getOrCreateCurrentCycle,
  getLatestSealed,
  getOrCreateDraft,
  saveRating,
  sealAssessment,
  upsertDirectionNarrative,
} from "@/db/assessment";
import { assessmentStepHref, firstUnanswered } from "@/lib/assessment";
import { RATING_SCALES, SCALE_MAX, SCALE_MIN, isDomainSlug } from "@/lib/domains";
import { requireUserId } from "@/lib/session";
import { todayInSaoPaulo } from "@/lib/utils";

// Same-origin only, matching src/app/onboarding/actions.ts.
function safeNext(formData: FormData): string {
  const next = formData.get("next");
  return typeof next === "string" && next.startsWith("/") ? next : "/assessment";
}

const scale = z.coerce.number().int().min(SCALE_MIN).max(SCALE_MAX);

// Validated at the write boundary, the same way daily details are
// (src/lib/details-schemas.ts). The six sliders can only send 1–10, so this
// catches a hand-built request rather than a user mistake.
const ratingSchema = z.object(
  Object.fromEntries(RATING_SCALES.map((key) => [key, scale]))
);

export async function startAssessment(): Promise<void> {
  const userId = await requireUserId();
  const today = todayInSaoPaulo();
  const cycle = await getOrCreateCurrentCycle(userId, today);
  const draft = await getOrCreateDraft(userId, cycle.id, today);
  const next = firstUnanswered(draft.ratings);
  redirect(assessmentStepHref(next ?? "results"));
}

export async function saveDomainRating(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const slug = String(formData.get("domain") ?? "");
  if (!isDomainSlug(slug)) redirect("/assessment");

  const parsed = ratingSchema.safeParse(
    Object.fromEntries(RATING_SCALES.map((key) => [key, formData.get(key)]))
  );
  // A partial grid can't be submitted from the UI (Continue is disabled), so
  // this is a malformed request. Send them back to the step rather than
  // writing half a domain.
  if (!parsed.success) redirect(assessmentStepHref(slug));

  const today = todayInSaoPaulo();
  const cycle = await getOrCreateCurrentCycle(userId, today);
  const draft = await getOrCreateDraft(userId, cycle.id, today);
  const domainIds = await getDomainIds();

  const written = await saveRating(userId, draft.id, domainIds[slug], {
    possibility: parsed.data.possibility,
    importanceNow: parsed.data.importanceNow,
    importanceGeneral: parsed.data.importanceGeneral,
    action: parsed.data.action,
    actionSatisfaction: parsed.data.actionSatisfaction,
    concern: parsed.data.concern,
  });
  // The write is refused when the assessment is already sealed. That is not an
  // error, it is a browser-back into a finished check-in.
  if (!written) redirect(assessmentStepHref("results"));

  // Re-read rather than trusting what we just sent: sealing must be decided by
  // what is actually in the table.
  const after = await getOpenDraft(userId);
  if (after && !firstUnanswered(after.ratings)) {
    // "already-sealed" happens on a double-tapped Continue and lands in the
    // same place as success, which is the only sensible outcome for the person
    // holding the phone.
    await sealAssessment(userId, after.id);
    redirect(assessmentStepHref("results"));
  }

  redirect(safeNext(formData));
}

// Abandon a check-in begun on an earlier day and open a fresh one. Only ever
// removes draft rows, so nothing sealed is touched and append-only holds.
export async function restartAssessment(): Promise<void> {
  const userId = await requireUserId();
  const draft = await getOpenDraft(userId);
  if (draft) await discardDraft(userId, draft.id);
  const today = todayInSaoPaulo();
  const cycle = await getOrCreateCurrentCycle(userId, today);
  await getOrCreateDraft(userId, cycle.id, today);
  redirect(assessmentStepHref("intro"));
}

// Save one direction. Upserts on (cycle, domain) so revisiting a domain edits
// what is there rather than stacking rows. Narratives are not sealed the way
// ratings are: the grid is a measurement and must not move, a direction is
// something you are allowed to word better next week.
export async function saveDirection(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const slug = String(formData.get("domain") ?? "");
  if (!isDomainSlug(slug)) redirect("/assessment/directions");

  const sealed = await getLatestSealed(userId);
  if (!sealed) redirect("/assessment");

  const domainIds = await getDomainIds();
  await upsertDirectionNarrative(userId, sealed.cycleId, domainIds[slug], {
    rawReflection: String(formData.get("rawReflection") ?? "").trim().slice(0, 4000),
    narrative: String(formData.get("narrative") ?? "").trim().slice(0, 400),
  });

  redirect(safeNext(formData));
}
