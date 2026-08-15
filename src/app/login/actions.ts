"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE,
  AUTH_MAX_AGE_SECONDS,
  createAuthCookieValue,
} from "@/lib/auth";
import { DUMMY_PASSWORD_HASH, toHandle, verifyPassword } from "@/lib/password";
import { isPasswordValid } from "@/lib/password-rules";
import { claimAccount, findUserByName } from "@/db/users";
import type { LoginErrorCode } from "@/lib/i18n";
import {
  checkLoginGuard,
  clearLoginFailures,
  registerLoginFailure,
  sleep,
} from "@/lib/login-guard";

// Errors travel as codes; LoginForm renders them in the selected language.
export interface LoginState {
  // "password" asks for an existing password; "claim" offers to set the first
  // one on an account that has never been signed into.
  step: "name" | "password" | "claim";
  name: string;
  error: LoginErrorCode | null;
  retryMinutes?: number;
}

async function startSession(userId: number): Promise<void> {
  (await cookies()).set(
    AUTH_COOKIE,
    await createAuthCookieValue(userId, process.env.AUTH_SECRET ?? ""),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: AUTH_MAX_AGE_SECONDS,
      path: "/",
    }
  );
}

async function clientIp(): Promise<string> {
  return ((await headers()).get("x-forwarded-for") ?? "unknown")
    .split(",")[0]
    .trim();
}

// Step 1 → 2. An unknown name is sent to the password step and fails there
// with the same wrong-credentials message, so the form can't be used to
// enumerate who has an account. Only an unclaimed account reveals itself —
// which is the point of the claim flow, and why names aren't published.
export async function submitName(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const raw = formData.get("name");
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length === 0) {
    return { step: "name", name: "", error: "missing" };
  }

  const limit = await checkLoginGuard(await clientIp());
  if (limit.blocked) {
    return {
      step: "name",
      name,
      error: "rate_limited",
      retryMinutes: limit.retryAfterMinutes,
    };
  }

  const user = await findUserByName(name);
  return {
    step: user && user.passwordHash === null ? "claim" : "password",
    name,
    error: null,
  };
}

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const name = String(formData.get("name") ?? "").trim();
  const password = formData.get("password");
  if (!process.env.AUTH_SECRET) {
    return { step: "password", name, error: "server" };
  }
  if (typeof password !== "string" || password.length === 0) {
    return { step: "password", name, error: "missing" };
  }

  // Progressive backoff, then a block by IP — never a lock on the handle. See
  // src/lib/login-guard.ts for why that distinction is the important one.
  const ip = await clientIp();
  const handle = toHandle(name);
  const limit = await checkLoginGuard(ip);
  if (limit.blocked) {
    return {
      step: "password",
      name,
      error: "rate_limited",
      retryMinutes: limit.retryAfterMinutes,
    };
  }

  const user = await findUserByName(name);

  // ALWAYS verify, even when there is no such account.
  //
  // The wording of the answer was already identical for an unknown name and a
  // wrong password; the timing was not. Falling back to a real hash of a
  // password nobody has means the miss path pays the same 600k iterations as
  // the hit path, so the two cannot be told apart by a stopwatch. An unclaimed
  // account takes the same branch, for the same reason.
  const stored = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const ok = await verifyPassword(password, stored);

  if (!user || user.passwordHash === null || !ok) {
    await registerLoginFailure(ip, handle);
    // The growing delay is what makes automated guessing pointless. It is
    // spent after the check, so a person who finally gets it right is not
    // made to wait for their earlier mistakes.
    await sleep(limit.delayMs);
    return { step: "password", name, error: "wrong" };
  }

  await clearLoginFailures(ip, handle);
  await startSession(user.id);
  redirect("/");
}

// First sign-in on an account created by script: set the password and go
// home. Where a brand-new account actually lands from there is the (app)
// gate's call, not this action's — it has no active habit yet, so the gate
// sends it into the values check-in. Redirecting straight to a hardcoded
// route here would be a second place that has to agree with the gate about
// where onboarding starts, which is the exact bug this replaced.
export async function claim(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const name = String(formData.get("name") ?? "").trim();
  const password = formData.get("password");
  if (!process.env.AUTH_SECRET) {
    return { step: "claim", name, error: "server" };
  }
  if (typeof password !== "string" || !isPasswordValid(password)) {
    return { step: "claim", name, error: "weak" };
  }

  const user = await findUserByName(name);
  // Already claimed (or gone) between the two steps — fall back to signing in.
  if (!user) return { step: "password", name, error: "wrong" };
  if (user.passwordHash !== null) {
    return { step: "password", name, error: null };
  }
  if (!(await claimAccount(user.id, password))) {
    return { step: "password", name, error: null };
  }

  await startSession(user.id);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}
