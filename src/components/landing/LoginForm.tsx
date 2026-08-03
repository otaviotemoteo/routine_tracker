"use client";

import { useActionState, useState } from "react";
import { LogIn, KeyRound } from "lucide-react";
import { claim, login, submitName, type LoginState } from "@/app/login/actions";
import { PasswordRules } from "@/components/landing/PasswordRules";
import { isPasswordValid } from "@/lib/password-rules";
import { format, type Copy } from "@/lib/i18n";

interface LoginFormProps {
  copy: Copy["landing"];
}

// Lives here, not in actions.ts: a "use server" module may only export async
// functions, and a constant smuggled out of one arrives malformed.
const INITIAL_STATE: LoginState = { step: "name", name: "", error: null };

const fieldClass =
  "min-h-[44px] px-4 border-2 border-forest rounded-lg bg-cream font-mono focus:bg-white";

const buttonClass =
  "min-h-[48px] inline-flex items-center justify-center gap-2 px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-hard";

// Sign-in is two steps: the name, then either the password or — for an account
// that has never been signed into — choosing the first one. Accounts are
// created by script only, so there is no "create account" path here.
export function LoginForm({ copy }: LoginFormProps) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    router,
    INITIAL_STATE
  );
  const [newPassword, setNewPassword] = useState("");

  const errorMessage =
    state.error === "rate_limited"
      ? format(copy.errors.rateLimited, { minutes: state.retryMinutes ?? 15 })
      : state.error
        ? copy.errors[state.error]
        : null;

  const claiming = state.step === "claim";
  const heading = claiming ? copy.claimHeading : copy.loginHeading;

  return (
    <section
      aria-label={heading}
      className="mt-14 bg-white border-2 border-forest rounded-card shadow-hard p-6 sm:p-8 w-full max-w-md"
    >
      <h2 className="display-title text-2xl">{heading}</h2>
      {claiming && (
        <p className="text-sm opacity-75 mt-2 text-left">
          {format(copy.claimLead, { name: state.name })}
        </p>
      )}

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="step" value={state.step} />

        {state.step === "name" ? (
          <div className="flex flex-col gap-1.5 text-left">
            <label htmlFor="name" className="font-semibold">
              {copy.nameLabel}
            </label>
            <input
              id="name"
              name="name"
              required
              autoFocus
              autoComplete="username"
              defaultValue={state.name}
              aria-describedby={errorMessage ? "login-error" : undefined}
              className={fieldClass}
            />
          </div>
        ) : (
          <>
            <input type="hidden" name="name" value={state.name} />
            <div className="flex flex-col gap-1.5 text-left">
              <label htmlFor="password" className="font-semibold">
                {claiming ? copy.newPasswordLabel : copy.passwordLabel}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoFocus
                autoComplete={claiming ? "new-password" : "current-password"}
                value={claiming ? newPassword : undefined}
                onChange={
                  claiming ? (e) => setNewPassword(e.target.value) : undefined
                }
                aria-describedby={errorMessage ? "login-error" : undefined}
                className={fieldClass}
              />
            </div>
            {claiming && <PasswordRules value={newPassword} copy={copy} />}
          </>
        )}

        {errorMessage && (
          <p
            id="login-error"
            role="alert"
            className="text-sm font-semibold text-forest bg-mint border-2 border-forest rounded-lg px-3 py-2 text-left"
          >
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || (claiming && !isPasswordValid(newPassword))}
          className={buttonClass}
        >
          {claiming ? (
            <KeyRound aria-hidden className="w-5 h-5" />
          ) : (
            <LogIn aria-hidden className="w-5 h-5" />
          )}
          {pending
            ? copy.submitting
            : state.step === "name"
              ? copy.continueLabel
              : claiming
                ? copy.createPassword
                : copy.submit}
        </button>
      </form>
    </section>
  );
}

// One action prop for useActionState, dispatching on the step the form was
// rendered at — so the whole flow keeps a single pending state and a single
// error region.
async function router(
  prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const step = String(formData.get("step") ?? "name");
  if (step === "claim") return claim(prev, formData);
  if (step === "password") return login(prev, formData);
  return submitName(prev, formData);
}
