"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Sparkles } from "lucide-react";
import { primaryButton } from "@/components/ui/styles";

interface GenerateHabitsButtonProps {
  generates: boolean;
  label: string;
  generatingLabel: string;
  manualLabel: string;
}

// P8 — /onboarding/areas's one primary action, disabled+spinner while the
// model call is in flight. Only the AI path waits on anything: the manual
// fallback ("Add habits manually") navigates instantly, so it never shows a
// spinner of its own.
export function GenerateHabitsButton({
  generates,
  label,
  generatingLabel,
  manualLabel,
}: GenerateHabitsButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={generates && pending}
      className={`${primaryButton} w-full sm:w-auto`}
    >
      {generates &&
        (pending ? (
          <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <Sparkles className="w-5 h-5" aria-hidden />
        ))}
      {generates ? (pending ? generatingLabel : label) : manualLabel}
    </button>
  );
}
