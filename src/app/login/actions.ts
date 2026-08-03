"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE,
  AUTH_MAX_AGE_SECONDS,
  createAuthCookieValue,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { isPasswordValid } from "@/lib/password-rules";
import { claimAccount, findUserByName } from "@/db/users";
import type { LoginErrorCode } from "@/lib/i18n";
import {
  clearLoginFailures,
  isLoginBlocked,
  registerLoginFailure,
} from "@/lib/rate-limit";

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

  const limit = isLoginBlocked(await clientIp());
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

  // Brute-force guard: 5 wrong attempts per IP per 15 min.
  const ip = await clientIp();
  const limit = isLoginBlocked(ip);
  if (limit.blocked) {
    return {
      step: "password",
      name,
      error: "rate_limited",
      retryMinutes: limit.retryAfterMinutes,
    };
  }

  const user = await findUserByName(name);
  if (
    !user ||
    user.passwordHash === null ||
    !(await verifyPassword(password, user.passwordHash))
  ) {
    registerLoginFailure(ip);
    return { step: "password", name, error: "wrong" };
  }
  clearLoginFailures(ip);

  await startSession(user.id);
  redirect("/");
}

// First sign-in on an account created by script: set the password and go
// straight into onboarding, which is where a brand-new account should start.
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
  redirect("/onboarding");
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}
