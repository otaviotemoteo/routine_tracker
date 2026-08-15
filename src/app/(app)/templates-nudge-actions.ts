"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TEMPLATES_NUDGE_SEEN_COOKIE } from "@/lib/templates";
import { requireUserId } from "@/lib/session";

// Both exits from the first-run templates nudge — "Choose templates" and
// "Not now" — go through this one action, because either way the nudge has
// done its job and shouldn't come back. Mirrors finishOnboarding() in
// src/app/onboarding/actions.ts: a Server Component can only read cookies,
// so marking one "seen" always has to happen here, not on the page that
// shows it.
export async function dismissTemplatesNudgeAction(
  formData: FormData
): Promise<void> {
  await requireUserId();
  (await cookies()).set(TEMPLATES_NUDGE_SEEN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  const to = formData.get("to");
  redirect(typeof to === "string" && to.startsWith("/") ? to : "/");
}
