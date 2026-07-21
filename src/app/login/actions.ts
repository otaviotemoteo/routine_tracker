"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE,
  AUTH_MAX_AGE_SECONDS,
  createAuthCookieValue,
  passwordsMatch,
} from "@/lib/auth";

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
  if (!(await passwordsMatch(password, expected, secret))) {
    return { error: "Senha incorreta. Tente de novo." };
  }

  (await cookies()).set(AUTH_COOKIE, await createAuthCookieValue(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_MAX_AGE_SECONDS,
    path: "/",
  });
  redirect("/");
}
