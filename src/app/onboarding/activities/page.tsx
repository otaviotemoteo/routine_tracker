import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { AssessmentShell } from "@/components/assessment/AssessmentShell";
import { StepTitle } from "@/components/onboarding/OnboardingChrome";
import { ActivityKindPicker } from "@/components/onboarding/ActivityKindPicker";
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
import { primaryButton, ghostButton, iconButton } from "@/components/ui/styles";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

interface ActivitiesPageProps {
  searchParams: Promise<{ failed?: string }>;
}

// The last leg of onboarding, and the only one that isn't a gate. By the time
// this renders, "Start tracking" has already run — habits are active, the
// NavBar is already showing, and Today already works. This screen is a
// one-time OFFER, not a step anyone can get stuck behind: leaving via the nav
// is always available, and not picking a kind for a habit is exactly what
// "declining" looks like (HABIT-VS-ACTIVITY-MODEL.md's "empty is a signal,
// not a failure").
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
  const habitNameById = new Map(allHabits.map((h) => [h.id, h.name]));

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

  return (
    <AssessmentShell lang={lang} navCopy={COPY[lang].nav} chrome="nav" firstRun={firstRun}>
      <p className="eyebrow">{copy.eyebrow}</p>
      <StepTitle backLabel={copy.eyebrow}>{copy.title}</StepTitle>
      <p className="mt-2 mb-6 opacity-75">{copy.lead}</p>

      {params.failed === "1" && (
        <p className="mb-6 flex items-start gap-2.5 border-2 border-forest bg-straw/15 rounded-card px-4 py-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
          <span className="min-w-0">{copy.generateFailed}</span>
        </p>
      )}

      {proposed.length > 0 && (
        <div className="mb-8 flex flex-col gap-3">
          <p className="font-semibold">
            {format(copy.reviewTitle, { n: proposed.length })}
          </p>
          <p className="text-sm opacity-75">{copy.reviewLead}</p>
          <ul className="flex flex-col gap-2 list-none">
            {proposed.map((activity) => (
              <li
                key={activity.id}
                className="flex items-center justify-between gap-3 border-2 border-forest bg-straw/15 rounded-card px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {habitNameById.get(activity.habitId) ?? activity.name}
                  </span>
                  <span className="block text-xs opacity-70">{activity.name}</span>
                </span>
                <span className="shrink-0 flex items-center gap-2">
                  <Link
                    href={`/config?activity=${activity.id}`}
                    className="text-xs font-bold underline"
                  >
                    {copy.reviewEdit}
                  </Link>
                  <form action={rejectActivityAction}>
                    <input type="hidden" name="id" value={activity.id} />
                    <button
                      type="submit"
                      aria-label={`${copy.reject} ${activity.name}`}
                      className={iconButton}
                    >
                      <X className="w-4 h-4 text-[#a8452f]" aria-hidden />
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
          <form action={acceptActivitiesAction} className="mt-1">
            <button type="submit" className={primaryButton}>
              {copy.acceptAll}
            </button>
          </form>
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
                  href={`/config?activity=${activity.id}`}
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
        <ActivityKindPicker
          habits={candidates}
          copy={copy}
          action={generateActivitiesAction}
        />
      ) : (
        proposed.length === 0 &&
        done.length === 0 && <p className="opacity-75">{copy.noneLeft}</p>
      )}

      <div className="mt-8 flex items-center gap-3 flex-wrap">
        <Link href="/" className={candidates.length > 0 ? ghostButton : primaryButton}>
          {candidates.length > 0 ? copy.skip : copy.continueLabel}
        </Link>
      </div>
    </AssessmentShell>
  );
}
