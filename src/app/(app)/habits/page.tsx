import Link from "next/link";
import { Plus } from "lucide-react";
import { StepTitle } from "@/components/onboarding/OnboardingChrome";
import { HabitGroups } from "@/components/habits/HabitGroups";
import { PendingNotice } from "@/components/habits/PendingNotice";
import { removeHabitAction } from "./actions";
import { getHabitStreaks, listHabits, listProposedHabits } from "@/db/habits";
import { findPendingRequest } from "@/db/ai";
import { getLang } from "@/lib/get-lang";
import { COPY, format } from "@/lib/i18n";
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

  const today = todayInSaoPaulo();
  const [habits, proposed, pending, streaks] = await Promise.all([
    listHabits(userId, today),
    listProposedHabits(userId),
    findPendingRequest(userId, "habit_suggester"),
    getHabitStreaks(userId, today),
  ]);

  // Habits with no life area still count on Today, but they sit outside the
  // per-area totals in the week and month views — which is a quiet way to be
  // wrong about your own week, so the screen says it out loud.
  const unanchored = habits.filter((h) => h.domainSlug === null).length;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <p className="eyebrow">{copy.eyebrow}</p>
      {/* The count sits beside the title rather than under it: it is the one
          number this screen has, and it answers "how much am I carrying?"
          before you read a single row. */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <StepTitle backHref="/overview" backLabel={copy.back}>
          {copy.title}
        </StepTitle>
        {habits.length > 0 && (
          <p className="shrink-0 border-2 border-forest rounded-card bg-white px-3 py-1.5 text-right leading-none">
            <span className="block font-mono font-bold text-lg">
              {habits.length}
            </span>
            <span className="block text-[10px] font-bold tracking-wider opacity-50 mt-1">
              {copy.activeLabel}
            </span>
          </p>
        )}
      </div>
      <p className="mt-2 mb-6 opacity-75">{copy.lead}</p>

      {unanchored > 0 && (
        <div className="mb-6 border-2 border-forest bg-straw/25 rounded-card px-4 py-3">
          <p className="font-mono text-[10px] font-bold tracking-wider opacity-70">
            {format(copy.noAreaEyebrow, { n: unanchored })}
          </p>
          <p className="mt-1.5 text-sm">{copy.noAreaLead}</p>
        </div>
      )}

      {/* A generation that failed left a request behind. Quiet and
          non-blocking: the app never freezes on somebody else's outage. */}
      {pending && <PendingNotice copy={copy} />}

      {/* Suggestions written but never accepted are still waiting. Pointing
          at them is better than leaving them invisible forever — the review
          screen is where they can be accepted or thrown away. */}
      {proposed.length > 0 && !pending && (
        <p className="mb-6 border-2 border-forest bg-mint rounded-card px-4 py-3">
          <Link href="/onboarding/habits" className="font-semibold underline">
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
            streaks={streaks}
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
