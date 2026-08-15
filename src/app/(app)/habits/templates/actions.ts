"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { setHabitTemplate } from "@/db/habits";
import { parseChecklistItems } from "@/lib/checklist";
import { GENERIC_TEMPLATE_KINDS } from "@/lib/templates";
import { requireUserId } from "@/lib/session";

const setTemplateSchema = z.object({
  habitId: z.coerce.number().int().positive(),
  kind: z.enum(GENERIC_TEMPLATE_KINDS),
  // Checklist only: the raw textarea, one item per line.
  items: z.string().optional(),
});

// The chooser's one write: pick a card style for a habit, saved the instant
// it's tapped. Deliberately its own action rather than a case inside
// habits/actions.ts's updateHabitAction — see setHabitTemplate() in
// src/db/habits.ts for why template_kind gets a dedicated, narrow write path.
export async function setHabitTemplateAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const parsed = setTemplateSchema.safeParse({
    habitId: formData.get("habitId"),
    kind: formData.get("kind"),
    items: formData.get("items") ?? undefined,
  });
  // Not reachable through the real UI — the form only ever sends one of the
  // five kinds with a valid id — so this is a hand-built-request guard, not a
  // user-facing error path.
  if (!parsed.success) redirect("/habits/templates");

  let config: unknown;
  if (parsed.data.kind === "checklist") {
    const items = parseChecklistItems(parsed.data.items ?? "");
    // A real user CAN reach this by submitting the item form empty — the
    // client disables Save until there's at least one, but nothing stops a
    // resubmit. Redirect with the flag the page reads to explain why nothing
    // saved, rather than silently doing nothing.
    if (items.length === 0) redirect("/habits/templates?error=checklist");
    config = { items };
  }

  await setHabitTemplate(userId, parsed.data.habitId, parsed.data.kind, config);

  // No redirect on success: this form posts from inside the chooser's own
  // accordion, and revalidating in place (rather than navigating) is what
  // lets the accordion stay open on the habit that was just touched instead
  // of resetting to fully collapsed.
  //
  // Today, the habits list, this screen's own counter, and the Overview
  // entry point all show this choice.
  revalidatePath("/");
  revalidatePath("/habits");
  revalidatePath("/habits/templates");
  revalidatePath("/overview");
}
