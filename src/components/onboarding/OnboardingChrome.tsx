"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Copy } from "@/lib/i18n";
import { ghostButton, iconButton, primaryButton } from "@/components/ui/styles";

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

interface StepTitleProps {
  children: React.ReactNode;
  // When present, the title itself carries the way back — no separate link
  // above it, and nothing to scroll past.
  backHref?: string;
  backLabel: string;
}

export function StepTitle({ children, backHref, backLabel }: StepTitleProps) {
  return (
    <h1 className="display-title text-3xl sm:text-4xl flex items-center gap-3">
      {backHref && (
        // The app's standard icon-button — bordered, shadowed, white by
        // default — so "back" reads as the same kind of control as every
        // other icon-only affordance (HabitRow's edit/remove, ListCard's),
        // rather than a bare arrow with no chrome of its own. White rather
        // than filled is already iconButton's resting state: going back
        // isn't the primary action on these screens, so it should never
        // outweigh the one that is.
        <Link href={backHref} aria-label={backLabel} className={`${iconButton} -ml-1`}>
          <ArrowLeft className="w-5 h-5" aria-hidden />
        </Link>
      )}
      {children}
    </h1>
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

// Submit button that reports the enclosing form's pending state — saving is a
// server round trip, so it needs to be visibly in progress.
function SubmitButton({
  label,
  savingLabel,
  disabled,
}: {
  label: string;
  savingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={primaryButton}
    >
      {pending && (
        <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />
      )}
      {pending ? savingLabel : label}
    </button>
  );
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
        <SubmitButton
          label={submitLabel}
          savingLabel={copy.saving}
          disabled={requireDirtyToSave && !dirty}
        />
      </div>

      <dialog
        ref={dialogRef}
        onClose={keepEditing}
        aria-labelledby="unsaved-changes-title"
        className="bg-transparent p-0 backdrop:bg-forest/40"
      >
        {/* Wider than the default sheet so the two actions fit on one row:
            at 22rem "Continuar editando" wrapped and the buttons went ragged. */}
        <div className="bg-white border-2 border-forest rounded-card shadow-hard p-6 w-[min(26rem,92vw)] text-forest">
          <h2 id="unsaved-changes-title" className="display-title text-xl">
            {copy.unsaved.title}
          </h2>
          <p className="mt-2 opacity-75 text-sm">{copy.unsaved.text}</p>
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={keepEditing}
              className={`${ghostButton} flex-1 whitespace-nowrap`}
            >
              {copy.unsaved.keepEditing}
            </button>
            <button
              type="button"
              onClick={confirmLeave}
              className={`${primaryButton} flex-1 whitespace-nowrap`}
            >
              {copy.unsaved.leave}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
