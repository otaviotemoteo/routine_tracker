"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  activateProposedHabits,
  createHabit,
  getHabit,
  removeHabit,
  updateHabit,
  type HabitInput,
} from "@/db/habits";
import { resolvePendingRequest } from "@/db/ai";
import { clearFirstRunStep } from "@/db/first-run";
import { isDomainSlug } from "@/lib/domains";
import { PLAIN_KIND } from "@/lib/templates";
import { requireUserId } from "@/lib/session";
import { todayInSaoPaulo } from "@/lib/utils";

// Same-origin only, matching src/app/onboarding/actions.ts and
// src/app/assessment/actions.ts.
function safeNext(formData: FormData, fallback: string): string {
  const next = formData.get("next");
  return typeof next === "string" && next.startsWith("/") ? next : fallback;
}

// Validated at the write boundary, the way daily details and assessment
// ratings are. The form can't send anything else, so this catches a
// hand-built request rather than a user mistake.
//
// `templateKind` is absent on purpose: every habit created through this app is
// plain, and accepting the field would mean trusting a form post to name a
// renderer. See src/lib/templates.ts.
const habitSchema = z.object({
  name: z.string().trim().min(1).max(50),
  domainSlug: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || isDomainSlug(v), "Unknown area")
    .transform((v) => (v === null ? null : (v as never))),
  metricType: z.enum(["binary", "count", "duration"]),
  unit: z
    .string()
    .trim()
    .max(20)
    .transform((v) => (v === "" ? null : v)),
  target: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v > 0 && v <= 100_000),
      "Target must be a positive whole number"
    ),
  minimalAction: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v)),
});

function parseForm(formData: FormData) {
  return habitSchema.safeParse({
    name: formData.get("name") ?? "",
    domainSlug: formData.get("domainSlug") ?? "",
    metricType: formData.get("metricType") ?? "binary",
    unit: formData.get("unit") ?? "",
    target: formData.get("target") ?? "",
    minimalAction: formData.get("minimalAction") ?? "",
  });
}

function toInput(data: z.infer<typeof habitSchema>): HabitInput {
  return {
    name: data.name,
    domainSlug: data.domainSlug,
    metricType: data.metricType,
    // A binary habit counts nothing, so a unit or a target left over from
    // switching the metric in the form would render as a figure that means
    // nothing. Dropped here rather than hidden in the UI.
    unit: data.metricType === "binary" ? null : data.unit,
    target: data.metricType === "binary" ? null : data.target,
    minimalAction: data.minimalAction,
    templateKind: PLAIN_KIND,
    why: null,
  };
}

export async function createHabitAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const parsed = parseForm(formData);
  if (!parsed.success) redirect("/habits/new?error=1");

  // Where the habit lands depends on where it was added from. On the review
  // screen it joins the proposed set (invisible until "Start tracking"); from
  // the habits list it is tracked straight away, because there is no later
  // step there to accept it in.
  const proposed = formData.get("proposed") === "1";
  await createHabit(userId, toInput(parsed.data), {
    source: "human",
    activeFrom: proposed ? null : todayInSaoPaulo(),
  });

  revalidatePath("/habits");
  revalidatePath("/");
  redirect(safeNext(formData, "/habits"));
}

export async function updateHabitAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) redirect("/habits");

  const parsed = parseForm(formData);
  if (!parsed.success) redirect(`/habits/${id}?error=1`);

  // Ownership is in the UPDATE's WHERE clause, so a foreign id matches no row.
  // The redirect on failure says "not yours" and "doesn't exist" identically,
  // which is the same reason the login form has one error message.
  const ok = await updateHabit(userId, id, toInput(parsed.data));
  if (!ok) redirect("/habits");

  revalidatePath("/habits");
  revalidatePath("/");
  redirect(safeNext(formData, "/habits"));
}

export async function removeHabitAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) redirect("/habits");

  // Deletes a proposal, archives a tracked habit — see src/db/habits.ts. Never
  // destroys a row that daily checks point at.
  await removeHabit(userId, id, todayInSaoPaulo());

  revalidatePath("/habits");
  revalidatePath("/");
  redirect(safeNext(formData, "/habits"));
}

// "Start tracking": the proposed set becomes real, all at once.
export async function startTrackingAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const activated = await activateProposedHabits(userId, todayInSaoPaulo());

  // Pressing this with nothing proposed shouldn't strand anyone on a screen
  // that now has nothing to show.
  if (activated === 0) {
    revalidatePath("/habits");
    redirect("/habits");
  }

  // The request has been satisfied — by a generator or by hand, it makes no
  // difference now. Re-generating over a set someone already accepted would be
  // a second surprise after they thought they were done.
  await resolvePendingRequest(userId, "habit_suggester");

  // The first run is over, so the churn column goes back to null: a completed
  // run leaves nothing behind.
  await clearFirstRunStep(userId);

  revalidatePath("/habits");
  revalidatePath("/");
  redirect(safeNext(formData, "/"));
}
