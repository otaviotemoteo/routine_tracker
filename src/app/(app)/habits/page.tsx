import Link from "next/link";
import { Plus } from "lucide-react";
import { StepTitle } from "@/components/onboarding/OnboardingChrome";
import { HabitGroups } from "@/components/habits/HabitGroups";
import { PendingNotice } from "@/components/habits/PendingNotice";
import { removeHabitAction } from "./actions";
import { listHabits, listProposedHabits } from "@/db/habits";
import { findPendingRequest } from "@/db/ai";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { primaryButton } from "@/components/ui/styles";
import { requireUserId } from "@/lib/session";
import { todayInSaoPaulo } from "@/lib/utils";

export const dynamic = "force-dynamic";

// The habits list — a reporting screen. It says what you track and offers one
// primary action (add). Changing a habit is a deliberate move into the form.
export default async function HabitsPage() {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang].habits;

  const [habits, proposed, pending] = await Promise.all([
    listHabits(userId, todayInSaoPaulo()),
    listProposedHabits(userId),
    findPendingRequest(userId, "habit_suggester"),
  ]);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <p className="eyebrow">{copy.eyebrow}</p>
      <StepTitle backHref="/" backLabel={copy.back}>
        {copy.title}
      </StepTitle>
      <p className="mt-2 mb-6 opacity-75">{copy.lead}</p>

      {/* A generation that failed left a request behind. Quiet and
          non-blocking: the app never freezes on somebody else's outage. */}
      {pending && <PendingNotice copy={copy} />}

      {/* Suggestions written but never accepted are still waiting. Pointing
          at them is better than leaving them invisible forever — the review
          screen is where they can be accepted or thrown away. */}
      {proposed.length > 0 && !pending && (
        <p className="mb-6 border-2 border-forest bg-mint rounded-card px-4 py-3">
          <Link href="/habits/review" className="font-semibold underline">
            {copy.reviewTitle}
          </Link>
        </p>
      )}

      {habits.length === 0 ? (
        <div className="border-2 border-forest rounded-card bg-white shadow-hard px-6 py-8 text-center">
          <h2 className="display-title text-2xl">{copy.emptyTitle}</h2>
          <p className="mt-2 opacity-75 max-w-prose mx-auto">{copy.emptyLead}</p>
          <Link href="/habits/new" className={`${primaryButton} mt-6`}>
            <Plus className="w-5 h-5" aria-hidden />
            {copy.add}
          </Link>
        </div>
      ) : (
        <>
          <HabitGroups
            habits={habits}
            lang={lang}
            copy={copy}
            removeAction={removeHabitAction}
            editHrefFor={(id) => `/habits/${id}`}
            next="/habits"
          />
          <div className="mt-8">
            <Link href="/habits/new" className={primaryButton}>
              <Plus className="w-5 h-5" aria-hidden />
              {copy.add}
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
