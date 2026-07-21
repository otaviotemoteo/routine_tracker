"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { login, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <section
      aria-label="Entrar"
      className="mt-14 bg-white border-2 border-forest rounded-card shadow-hard p-6 sm:p-8 max-w-md"
    >
      <h2 className="display-title text-2xl">Entrar</h2>
      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="font-semibold">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            aria-describedby={state.error ? "login-error" : undefined}
            className="min-h-[44px] px-4 border-2 border-forest rounded-lg bg-cream font-mono focus:bg-white"
          />
        </div>
        {state.error && (
          <p
            id="login-error"
            role="alert"
            className="text-sm font-semibold text-forest bg-mint border-2 border-forest rounded-lg px-3 py-2"
          >
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="min-h-[48px] inline-flex items-center justify-center gap-2 px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-hard"
        >
          <LogIn aria-hidden className="w-5 h-5" />
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </section>
  );
}
