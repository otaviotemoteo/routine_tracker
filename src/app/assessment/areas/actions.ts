"use server";

import { redirect } from "next/navigation";
import { markFirstRunStep } from "@/db/first-run";
import { requireUserId } from "@/lib/session";

// Leaving the areas review for the habits screen.
//
// Both buttons on that screen come through here — "Generate habits" and, when
// no provider is configured, "Add habits manually". They differ by one query
// parameter, because the destination is the same screen either way: Q4's rule
// is that a missing key degrades to the manual path rather than to a dead end,
// and the cheapest way to keep that honest is for the manual path to be the
// same screen with nothing on it yet.
//
// The generation itself is NOT started here. `?generate=1` is a request, and
// /habits/review decides: it generates only when the proposed set is empty, so
// a refresh — or a second press of a button that was already pressed — costs
// no quota. Consent is still explicit, because nothing generates without that
// parameter, and only this action puts it in the URL.
export async function goToHabitsAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();

  // The furthest step reached. Written on advance and cleared at "Start
  // tracking", so a value left in this column is by construction an
  // abandonment — see src/lib/first-run.ts.
  await markFirstRunStep(userId, "habits");

  const generate = formData.get("generate") === "1";
  redirect(generate ? "/habits/review?generate=1" : "/habits/review");
}
