import Link from "next/link";
import { Clock } from "lucide-react";
import type { Copy } from "@/lib/i18n";

// The "will regenerate later" notice.
//
// Straw, not red: a provider being down is a pending state, not the user's
// error. And a line with a link, not a dialog — reaching this takes all three
// providers failing at once, and the one thing that must not happen is the
// app blocking on somebody else's outage.
export function PendingNotice({ copy }: { copy: Copy["habits"] }) {
  return (
    <p className="mb-6 flex items-start gap-2.5 border-2 border-forest bg-straw rounded-card px-4 py-3">
      <Clock className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
      <span className="min-w-0">
        {copy.pendingNotice}{" "}
        <Link href="/habits/review" className="font-semibold underline">
          {copy.pendingAction}
        </Link>
      </span>
    </p>
  );
}
