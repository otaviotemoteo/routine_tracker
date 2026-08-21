import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AssessmentShell } from "@/components/assessment/AssessmentShell";
import { StepTitle } from "@/components/onboarding/OnboardingChrome";
import { ActivityBriefingForm } from "@/components/onboarding/ActivityBriefingForm";
import { ProposedActivityCard } from "@/components/onboarding/ProposedActivityCard";
import { FinishOnboardingButton } from "@/components/onboarding/FinishOnboardingButton";
import {
  acceptActivitiesAction,
  generateActivitiesAction,
  rejectActivityAction,
} from "./actions";
import { listHabits, listProposedActivities, listTrackedActivities } from "@/db/habits";
import { isChoosableTemplateKind } from "@/lib/templates";
import { format } from "@/lib/i18n";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { isFirstRun } from "@/lib/onboarding-flow";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

interface ActivitiesPageProps {
  searchParams: Promise<{ failed?: string; partialFail?: string }>;
}

// The last leg of onboarding, and the only one that isn't a gate. By the time
// this renders, "Start tracking" has already run — habits are active, the
// NavBar is already showing, and Today already works. Not writing a
// briefing for a habit is still a legitimate "declining" — it keeps its
// plain default activity, exactly the "empty is a signal, not a failure"
// state ARCHITECTURE.md describes — but there is deliberately no separate
// "skip this screen" invitation any more: activities are what Today's cards
// actually show, so the one way off this page (FinishOnboardingButton,
// below) always accepts whatever's pending first, never bypasses it.
//
// Three states, not two: still-plain habits to pick a kind + briefing for;
// generated activities waiting to be reviewed and accepted; and habits that
// already have a real activity, linking out to /config.
export default async function ActivitiesPage({
  searchParams,
}: ActivitiesPageProps) {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang].activities;
  const params = await searchParams;
  const firstRun = await isFirstRun(userId);

  const [allHabits, tracked, proposed] = await Promise.all([
    listHabits(userId),
    listTrackedActivities(userId),
    listProposedActivities(userId),
  ]);

  const richHabitIds = new Set(
    tracked.filter((a) => !isChoosableTemplateKind(a.templateKind)).map((a) => a.habitId)
  );
  const proposedHabitIds = new Set(proposed.map((a) => a.habitId));
  // A habit with a rich activity already tracked, OR one still pending
  // review, isn't a candidate any more — picking a second kind for it is
  // /config's "add an activity" job now, not this one-time offer's.
  const candidates = allHabits.filter(
    (h) => !richHabitIds.has(h.id) && !proposedHabitIds.has(h.id)
  );
  const done = tracked.filter((a) => !isChoosableTemplateKind(a.templateKind));

  // Two designed screens share this one route: Screen 3 (still collecting
  // briefings) and Screen 4 (reviewing what came back). Both can be true at
  // once — a person can leave some habits mid-review and others not yet
  // briefed — so the title follows whichever has real content to show,
  // review taking priority since it's the one with something to act on.
  const title = proposed.length > 0 ? copy.reviewScreenTitle : copy.title;
  const lead = proposed.length > 0 ? copy.reviewScreenLead : copy.lead;

  return (
    <AssessmentShell lang={lang} navCopy={COPY[lang].nav} chrome="nav" firstRun={firstRun}>
      <p className="eyebrow">{copy.eyebrow}</p>
      <StepTitle backLabel={copy.eyebrow}>{title}</StepTitle>
      <p className="mt-2 mb-6 opacity-75">{lead}</p>

      {params.failed === "1" && (
        <p className="mb-6 flex items-start gap-2.5 border-2 border-forest bg-straw/15 rounded-card px-4 py-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
          <span className="min-w-0">{copy.generateFailed}</span>
        </p>
      )}
      {params.partialFail && Number(params.partialFail) > 0 && (
        <p className="mb-6 flex items-start gap-2.5 border-2 border-forest bg-straw/15 rounded-card px-4 py-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
          <span className="min-w-0">
            {format(copy.generatePartialFail, { n: Number(params.partialFail) })}
          </span>
        </p>
      )}

      {proposed.length > 0 && (
        <div className="mb-8 flex flex-col gap-3">
          <p className="font-semibold">
            {format(copy.reviewTitle, { n: proposed.length })}
          </p>
          <p className="text-sm opacity-75">{copy.reviewLead}</p>
          <ul className="flex flex-col gap-3.5 list-none">
            {proposed.map((activity) => (
              <ProposedActivityCard
                key={activity.id}
                activity={activity}
                lang={lang}
                copy={copy}
                editHref={`/config?activity=${activity.id}&from=onboarding`}
                rejectAction={rejectActivityAction}
              />
            ))}
          </ul>
        </div>
      )}

      {done.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          <p className="text-sm font-semibold opacity-70">
            {format(copy.doneTitle, { n: done.length })}
          </p>
          <ul className="flex flex-col gap-2 list-none">
            {done.map((activity) => (
              <li
                key={activity.id}
                className="flex items-center justify-between gap-3 border-2 border-forest bg-mint rounded-card px-4 py-3"
              >
                <span className="font-semibold">{activity.name}</span>
                <Link
                  href={`/config?activity=${activity.id}&from=onboarding`}
                  className="text-xs font-bold underline shrink-0"
                >
                  {copy.editHint}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-sm opacity-75">{copy.doneLead}</p>
        </div>
      )}

      {candidates.length > 0 ? (
        <ActivityBriefingForm
          habits={candidates}
          lang={lang}
          copy={copy}
          action={generateActivitiesAction}
        />
      ) : (
        proposed.length === 0 &&
        done.length === 0 && <p className="opacity-75">{copy.noneLeft}</p>
      )}

      {/* Activities are what Today's cards actually show, so there's no
          skip here — one mandatory way off this screen: accept whatever's
          still proposed (a no-op if nothing is) and go to Today. */}
      <form action={acceptActivitiesAction} className="mt-8">
        <FinishOnboardingButton
          label={copy.finishOnboarding}
          finishingLabel={copy.accepting}
        />
      </form>
    </AssessmentShell>
  );
}
