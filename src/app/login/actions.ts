"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE,
  AUTH_MAX_AGE_SECONDS,
  createAuthCookieValue,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { findUserByName } from "@/db/users";
import type { LoginErrorCode } from "@/lib/i18n";
import {
  clearLoginFailures,
  isLoginBlocked,
  registerLoginFailure,
} from "@/lib/rate-limit";

// Errors travel as codes; LoginForm renders them in the selected language.
export interface LoginState {
  error: LoginErrorCode | null;
  retryMinutes?: number;
}

export async function startSession(userId: number, secret: string) {
  (await cookies()).set(
    AUTH_COOKIE,
    await createAuthCookieValue(userId, secret),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: AUTH_MAX_AGE_SECONDS,
      path: "/",
    }
  );
}

// The caller's IP, for the brute-force counter.
export async function clientIp(): Promise<string> {
  return ((await headers()).get("x-forwarded-for") ?? "unknown")
    .split(",")[0]
    .trim();
}

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const name = formData.get("name");
  const password = formData.get("password");
  const secret = process.env.AUTH_SECRET;

  if (!secret) return { error: "server" };
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    typeof password !== "string" ||
    password.length === 0
  ) {
    return { error: "missing" };
  }

  // Brute-force guard: 5 wrong attempts per IP per 15 min.
  const ip = await clientIp();
  const limit = isLoginBlocked(ip);
  if (limit.blocked) {
    return { error: "rate_limited", retryMinutes: limit.retryAfterMinutes };
  }

  // One error for both "no such name" and "wrong password": saying which was
  // wrong tells a stranger whose accounts exist.
  const user = await findUserByName(name);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    registerLoginFailure(ip);
    return { error: "wrong" };
  }
  clearLoginFailures(ip);

  await startSession(user.id, secret);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}
