"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { primaryButton } from "@/components/ui/styles";
import type { Copy } from "@/lib/i18n";

// "Start tracking" — the button that ends the first run.
//
// It is its own component only because useFormStatus has to be called from
// inside the form it reports on, and the review screen around it is a Server
// Component. The pending label matters more here than on the other forms in
// the app: this press writes a date onto every proposed row at once, and it is
// the moment Today stops being empty, so a second press would be a reasonable
// thing to try if nothing appeared to happen.
export function StartTrackingButton({ copy }: { copy: Copy["habits"] }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${primaryButton} w-full sm:w-auto`}
    >
      {pending && (
        <Loader2
          className="w-4 h-4 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
      )}
      {pending ? copy.starting : copy.startTracking}
    </button>
  );
}
