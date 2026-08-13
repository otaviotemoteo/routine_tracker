import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { StepTitle } from "@/components/onboarding/OnboardingChrome";
import { HabitGroups } from "@/components/habits/HabitGroups";
import { StartTrackingButton } from "@/components/habits/StartTrackingButton";
import { removeHabitAction, startTrackingAction } from "../actions";
import { findPendingRequest } from "@/db/ai";
import { listProposedHabits } from "@/db/habits";
import { suggestHabits } from "@/lib/ai/suggest-habits";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { ghostButton, primaryButton } from "@/components/ui/styles";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const HERE = "/habits/review";

interface ReviewPageProps {
  searchParams: Promise<{ generate?: string }>;
}

// The habits proposal screen.
//
// Every card here is already a row in `habits` with `active_from = NULL` —
// written to the database the moment it was generated, and invisible to Today,
// the week grid, the month view, the daily flow and the export until "Start
// tracking" fills that column in. "Nothing persists until you start" is a
// statement about what reaches Today, not about what reaches the database, and
// separating the two is free: it costs one nullable column and it means a
// backgrounded tab on a phone cannot lose a 5–20 second call that already
// spent a quota unit.
//
// This is an editing screen with exactly one primary action, and it must not
// grow a second. Edit and Remove are per-row; Add opens the form; Start
// tracking is the only thing that finishes it.
export default async function HabitsReviewPage({
  searchParams,
}: ReviewPageProps) {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang].habits;
  const params = await searchParams;

  let proposed = await listProposedHabits(userId);
  let failed = false;

  // Load order: existing proposals first, then an unresolved request left by a
  // previous outage, then — only if asked — a fresh generation.
  //
  // GENERATING ONLY WHEN THE SET IS EMPTY is what makes a refresh free. Coming
  // back to this screen, or reloading it, reads the rows that are already
  // there and writes no `ai_runs` row at all. And requiring `?generate=1`,
  // which only the areas review's button puts in the URL, is what keeps the
  // consent step meaningful: typing this URL never spends anything.
  if (proposed.length === 0) {
    const pending = await findPendingRequest(userId, "habit_suggester");
    if (params.generate === "1" || pending) {
      const outcome = await suggestHabits(userId, lang);
      // `unavailable` is not a failure to report — it is the no-key path, and
      // it renders as the empty screen with the manual form, which is exactly
      // what someone with no provider configured should see.
      failed = outcome.status === "error" || outcome.status === "invalid";
      if (outcome.status === "ok") proposed = await listProposedHabits(userId);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <p className="eyebrow">{copy.reviewEyebrow}</p>
      <StepTitle backHref="/assessment/areas" backLabel={copy.reviewEyebrow}>
        {copy.reviewTitle}
      </StepTitle>
      <p className="mt-2 mb-6 opacity-75">{copy.reviewLead}</p>

      {/* Straw, not red, and it does not block anything: a provider being down
          is not the user's error and must never be their problem. The habits
          they can write by hand are right underneath. */}
      {failed && (
        <p className="mb-6 flex items-start gap-2.5 border-2 border-forest bg-straw rounded-card px-4 py-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
          <span className="min-w-0">{copy.generateFailed}</span>
        </p>
      )}

      {proposed.length === 0 ? (
        <div className="border-2 border-forest rounded-card bg-white shadow-hard px-6 py-8 text-center">
          <h2 className="display-title text-2xl">{copy.reviewEmptyTitle}</h2>
          <p className="mt-2 opacity-75 max-w-prose mx-auto">
            {copy.reviewEmptyLead}
          </p>
          {/* The primary action in this state. "Start tracking" is deliberately
              absent here — there is nothing to start, and offering it would be
              a button whose only outcome is a redirect. */}
          <Link
            href="/habits/new?from=review"
            className={`${primaryButton} mt-6`}
          >
            <Plus className="w-5 h-5" aria-hidden />
            {copy.add}
          </Link>
        </div>
      ) : (
        <>
          {/* showSource marks a suggestion as a suggestion until it is touched
              — which is what makes accept / edit / reject legible rather than
              implicit. */}
          <HabitGroups
            habits={proposed}
            lang={lang}
            copy={copy}
            removeAction={removeHabitAction}
            editHrefFor={(id) => `/habits/${id}?from=review`}
            next={HERE}
            showSource
          />

          <div className="mt-6">
            <Link href="/habits/new?from=review" className={ghostButton}>
              <Plus className="w-4 h-4 mr-1.5" aria-hidden />
              {copy.add}
            </Link>
          </div>

          {/* The one primary action, and the only thing on this screen that
              makes anything real. */}
          <form action={startTrackingAction} className="mt-10">
            <input type="hidden" name="next" value="/" />
            <StartTrackingButton copy={copy} />
          </form>
        </>
      )}
    </main>
  );
}
