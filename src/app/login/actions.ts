"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE,
  AUTH_MAX_AGE_SECONDS,
  createAuthCookieValue,
  passwordsMatch,
} from "@/lib/auth";
import {
  clearLoginFailures,
  isLoginBlocked,
  registerLoginFailure,
} from "@/lib/rate-limit";

export interface LoginState {
  error: string | null;
}

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = formData.get("password");
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;

  if (!expected || !secret) {
    return { error: "Servidor sem APP_PASSWORD ou AUTH_SECRET configurados." };
  }
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Digite a senha." };
  }

  // Brute-force guard: 5 wrong passwords per IP per 15 min.
  const ip = ((await headers()).get("x-forwarded-for") ?? "unknown")
    .split(",")[0]
    .trim();
  const limit = isLoginBlocked(ip);
  if (limit.blocked) {
    return {
      error: `Muitas tentativas. Tente de novo em ${limit.retryAfterMinutes} min.`,
    };
  }

  if (!(await passwordsMatch(password, expected, secret))) {
    registerLoginFailure(ip);
    return { error: "Senha incorreta. Tente de novo." };
  }
  clearLoginFailures(ip);

  (await cookies()).set(AUTH_COOKIE, await createAuthCookieValue(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_MAX_AGE_SECONDS,
    path: "/",
  });
  redirect("/");
}
