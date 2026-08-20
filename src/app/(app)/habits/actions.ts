"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  activateProposedHabits,
  createHabit,
  getHabit,
  removeActivity,
  removeHabit,
  updateHabit,
  type DefaultActivityInput,
  type HabitEdit,
  type HabitInput,
} from "@/db/habits";
import { resolvePendingRequest } from "@/db/ai";
import { clearFirstRunStep } from "@/db/first-run";
import { isDomainSlug } from "@/lib/domains";
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
const habitEditSchema = z.object({
  name: z.string().trim().min(1).max(50),
  domainSlug: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || isDomainSlug(v), "Unknown area")
    .transform((v) => (v === null ? null : (v as never))),
});

// The default activity's metric spine — only collected when CREATING, since
// editing an existing habit no longer touches it (see HabitForm.tsx).
// `templateKind` is absent on purpose: every activity created through this
// form is plain, and accepting the field would mean trusting a form post to
// name a renderer. See src/lib/templates.ts.
const activityMetricSchema = z.object({
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

const habitCreateSchema = habitEditSchema.merge(activityMetricSchema);

function parseEditForm(formData: FormData) {
  return habitEditSchema.safeParse({
    name: formData.get("name") ?? "",
    domainSlug: formData.get("domainSlug") ?? "",
  });
}

function parseCreateForm(formData: FormData) {
  return habitCreateSchema.safeParse({
    name: formData.get("name") ?? "",
    domainSlug: formData.get("domainSlug") ?? "",
    metricType: formData.get("metricType") ?? "binary",
    unit: formData.get("unit") ?? "",
    target: formData.get("target") ?? "",
    minimalAction: formData.get("minimalAction") ?? "",
  });
}

// The fields the edit form actually shows — and therefore the only fields an
// edit is allowed to write. `why` is deliberately absent: the form has no
// input for it, and sending a default for a field nobody filled in is how
// the owner's seven habits lost their Today cards, back when this also
// carried the metric spine. The type makes including either a compile
// error; see HabitEdit in src/db/habits.ts.
function toEdit(data: z.infer<typeof habitEditSchema>): HabitEdit {
  return { name: data.name, domainSlug: data.domainSlug };
}

function toHabitInput(data: z.infer<typeof habitCreateSchema>): HabitInput {
  return { name: data.name, domainSlug: data.domainSlug, why: null };
}

function toActivityInput(
  data: z.infer<typeof habitCreateSchema>
): DefaultActivityInput {
  // A binary activity counts nothing, so a unit or a target left over from
  // switching the metric in the form would render as a figure that means
  // nothing. Dropped here rather than hidden in the UI.
  const binary = data.metricType === "binary";
  return {
    metricType: data.metricType,
    unit: binary ? null : data.unit,
    target: binary ? null : data.target,
    minimalAction: data.minimalAction,
  };
}

export async function createHabitAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const parsed = parseCreateForm(formData);
  if (!parsed.success) redirect("/habits/new?error=1");

  // Where the habit lands depends on where it was added from. On the review
  // screen it joins the proposed set (invisible until "Start tracking"); from
  // the habits list it is tracked straight away, because there is no later
  // step there to accept it in. Its default activity follows the same
  // lifecycle — see createHabit, src/db/habits.ts.
  const proposed = formData.get("proposed") === "1";
  await createHabit(
    userId,
    toHabitInput(parsed.data),
    toActivityInput(parsed.data),
    { source: "human", activeFrom: proposed ? null : todayInSaoPaulo() }
  );

  revalidatePath("/habits");
  revalidatePath("/");
  redirect(safeNext(formData, "/habits"));
}

export async function updateHabitAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) redirect("/habits");

  const parsed = parseEditForm(formData);
  if (!parsed.success) redirect(`/habits/${id}?error=1`);

  // Ownership is in the UPDATE's WHERE clause, so a foreign id matches no row.
  // The redirect on failure says "not yours" and "doesn't exist" identically,
  // which is the same reason the login form has one error message.
  const ok = await updateHabit(userId, id, toEdit(parsed.data));
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

// The habits LIST's own remove button, one row per activity now — this
// removes just that activity (and, in the common one-activity-per-habit
// case, is what makes the habit disappear from the list too, since a habit
// with zero live activities has nothing left to show a row for).
export async function removeActivityAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) redirect("/habits");

  await removeActivity(userId, id, todayInSaoPaulo());

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
