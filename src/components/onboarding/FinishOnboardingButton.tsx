"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { primaryButton } from "@/components/ui/styles";

interface FinishOnboardingButtonProps {
  label: string;
  finishingLabel: string;
}

// The one, always-present, mandatory way off /onboarding/activities —
// accepts whatever's still proposed (a no-op if nothing is) and lands on
// Today. See that page's own comment for why there's no separate skip.
export function FinishOnboardingButton({
  label,
  finishingLabel,
}: FinishOnboardingButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${primaryButton} w-full sm:w-auto`}
    >
      {pending && (
        <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />
      )}
      {pending ? finishingLabel : label}
    </button>
  );
}
