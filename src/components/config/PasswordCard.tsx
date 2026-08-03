"use client";

import { useActionState, useState } from "react";
import { KeyRound, Check } from "lucide-react";
import {
  updatePassword,
  type PasswordState,
} from "@/app/config/password-actions";
import { PasswordRules } from "@/components/landing/PasswordRules";
import { isPasswordValid } from "@/lib/password-rules";
import type { Copy } from "@/lib/i18n";

interface PasswordCardProps {
  copy: Copy["config"]["password"];
  // The password rules are worded once, on the landing copy.
  landingCopy: Copy["landing"];
}

const INITIAL_STATE: PasswordState = { status: "idle", error: null };

const fieldClass =
  "min-h-[44px] px-4 border-2 border-forest rounded-lg bg-cream font-mono focus:bg-white";

export function PasswordCard({ copy, landingCopy }: PasswordCardProps) {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    INITIAL_STATE
  );
  const [next, setNext] = useState("");

  return (
    <section className="bg-white border-2 border-forest rounded-card shadow-hard p-5">
      <h2 className="display-title text-xl">{copy.title}</h2>
      <p className="text-sm opacity-70 mt-1">{copy.lead}</p>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="current" className="font-semibold text-sm">
            {copy.currentLabel}
          </label>
          <input
            id="current"
            name="current"
            type="password"
            autoComplete="current-password"
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="next" className="font-semibold text-sm">
            {copy.newLabel}
          </label>
          <input
            id="next"
            name="next"
            type="password"
            required
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={fieldClass}
          />
        </div>

        <PasswordRules value={next} copy={landingCopy} />

        {state.error && (
          <p
            role="alert"
            className="text-sm font-semibold text-straw bg-straw/15 border-2 border-straw/40 rounded-lg px-3 py-2"
          >
            {state.error === "current" ? copy.errorCurrent : copy.errorWeak}
          </p>
        )}
        {state.status === "saved" && !state.error && (
          <p
            role="status"
            className="text-sm font-semibold text-clover bg-mint border-2 border-clover/40 rounded-lg px-3 py-2 flex items-center gap-2"
          >
            <Check aria-hidden className="w-4 h-4" strokeWidth={3} />
            {copy.saved}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !isPasswordValid(next)}
          className="min-h-[48px] self-start inline-flex items-center justify-center gap-2 px-6 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-hard"
        >
          <KeyRound aria-hidden className="w-5 h-5" />
          {pending ? copy.saving : copy.submit}
        </button>
      </form>
    </section>
  );
}
