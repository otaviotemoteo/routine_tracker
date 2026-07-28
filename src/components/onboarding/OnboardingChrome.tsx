"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Copy } from "@/lib/i18n";

// Shared Tailwind class strings so every step's inputs look identical.
// `fieldBase` carries no width — use it when the caller sets its own (two
// width utilities on one element fight, and the stylesheet order decides).
export const fieldBase =
  "min-h-[44px] px-3 border-2 border-forest rounded-lg bg-cream focus:bg-white";
export const inputClass = `${fieldBase} w-full`;
export const primaryButton =
  "min-h-[48px] inline-flex items-center justify-center gap-2 px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-hard";
export const ghostButton =
  "min-h-[44px] inline-flex items-center justify-center px-5 rounded-full border-2 border-forest bg-white font-semibold text-sm shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm";

interface ProgressProps {
  stepNumber: number;
  total: number;
  label: string;
}

export function OnboardingProgress({ stepNumber, total, label }: ProgressProps) {
  const percent = Math.round((stepNumber / total) * 100);
  return (
    <div className="mb-6">
      <p className="eyebrow mb-2">{label}</p>
      <div
        role="progressbar"
        aria-valuenow={stepNumber}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label}
        className="h-3 border-2 border-forest rounded-full bg-sand overflow-hidden"
      >
        <div
          className="h-full bg-clover transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// Guards navigation away from a dirty form: leaving instantly when there's
// nothing to lose, confirming through a modal when there is. Shared by every
// step's Back/Skip so an accidental tap can't silently drop typed changes.
function useNavGuard(dirty: boolean) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  function go(href: string) {
    if (dirty) {
      setPendingHref(href);
      dialogRef.current?.showModal();
    } else {
      router.push(href);
    }
  }

  function confirmLeave() {
    dialogRef.current?.close();
    if (pendingHref) router.push(pendingHref);
  }

  function keepEditing() {
    dialogRef.current?.close();
    setPendingHref(null);
  }

  return { go, dialogRef, confirmLeave, keepEditing };
}

interface FooterProps {
  backHref?: string;
  skipHref?: string;
  skipLabel: string;
  backLabel: string;
  submitLabel: string;
  copy: Copy["onboarding"];
  // Whether this step's fields differ from what was loaded. Drives the
  // unsaved-changes guard on Back/Skip, and (with requireDirtyToSave) whether
  // Save is enabled.
  dirty: boolean;
  // Config edits shouldn't let you "save" without changing anything; the
  // onboarding wizard should — clicking through defaults is normal there.
  requireDirtyToSave?: boolean;
}

// Rendered inside each step's <form>. Back/Skip navigate via the nav guard
// (confirming when the step is dirty); Continue submits the form (saves,
// then advances via the server action).
export function OnboardingFooter({
  backHref,
  skipHref,
  skipLabel,
  backLabel,
  submitLabel,
  copy,
  dirty,
  requireDirtyToSave,
}: FooterProps) {
  const { go, dialogRef, confirmLeave, keepEditing } = useNavGuard(dirty);

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mt-8">
      <div>
        {backHref && (
          <button type="button" onClick={() => go(backHref)} className={ghostButton}>
            {backLabel}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        {skipHref && (
          <button
            type="button"
            onClick={() => go(skipHref)}
            className="font-semibold text-sm underline min-h-[44px] inline-flex items-center px-2"
          >
            {skipLabel}
          </button>
        )}
        <button
          type="submit"
          disabled={requireDirtyToSave && !dirty}
          className={primaryButton}
        >
          {submitLabel}
        </button>
      </div>

      <dialog
        ref={dialogRef}
        onClose={keepEditing}
        aria-labelledby="unsaved-changes-title"
        className="bg-transparent p-0 backdrop:bg-forest/40"
      >
        <div className="bg-white border-2 border-forest rounded-card shadow-hard p-6 w-[min(22rem,90vw)] text-forest">
          <h2 id="unsaved-changes-title" className="display-title text-xl">
            {copy.unsaved.title}
          </h2>
          <p className="mt-2 opacity-75 text-sm">{copy.unsaved.text}</p>
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={keepEditing}
              className={`${ghostButton} flex-1`}
            >
              {copy.unsaved.keepEditing}
            </button>
            <button
              type="button"
              onClick={confirmLeave}
              className={`${primaryButton} flex-1`}
            >
              {copy.unsaved.leave}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
