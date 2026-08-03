"use server";

import { revalidatePath } from "next/cache";
import { changePassword, getPasswordHash } from "@/db/users";
import { verifyPassword } from "@/lib/password";
import { isPasswordValid } from "@/lib/password-rules";
import { requireUserId } from "@/lib/session";

export interface PasswordState {
  status: "idle" | "saved";
  error: "current" | "weak" | null;
}

// Changing your own password: the current one is required, so a borrowed
// session can't lock the owner out of their own account.
export async function updatePassword(
  _prev: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  const userId = await requireUserId();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!isPasswordValid(next)) return { status: "idle", error: "weak" };

  const hash = await getPasswordHash(userId);
  // A never-claimed account has no current password to check against.
  if (hash !== null && !(await verifyPassword(current, hash))) {
    return { status: "idle", error: "current" };
  }

  await changePassword(userId, next);
  revalidatePath("/config");
  return { status: "saved", error: null };
}
