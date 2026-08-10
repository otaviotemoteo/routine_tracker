import { redirect } from "next/navigation";
import { OnboardingProgress } from "@/components/onboarding/OnboardingChrome";
import { AssessmentShell } from "@/components/assessment/AssessmentShell";
import { DomainStep } from "@/components/assessment/DomainStep";
import { IntroStep } from "@/components/assessment/IntroStep";
import { ResumeStep } from "@/components/assessment/ResumeStep";
import { restartAssessment, saveDomainRating, startAssessment } from "./actions";
import { getLatestSealed, getOpenDraft } from "@/db/assessment";
import {
  answeredCount,
  assessmentStepHref,
  firstUnanswered,
  nextAssessmentHref,
  prevAssessmentHref,
  resolveAssessmentStep,
} from "@/lib/assessment";
import { TOTAL_DOMAINS, domainPosition, isDomainSlug } from "@/lib/domains";
import { getLang } from "@/lib/get-lang";
import { COPY, format } from "@/lib/i18n";
import { requireUserId } from "@/lib/session";
import { formatShortDayMonth, todayInSaoPaulo } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface AssessmentPageProps {
  searchParams: Promise<{ step?: string }>;
}

// The values check-in, in focus mode.
//
// Outside the (app) route group on purpose, so there is no nav bar to wander
// off through mid-grid — which is also why the language toggle is rendered
// here, exactly as /onboarding and /config do it.
export default async function AssessmentPage({
  searchParams,
}: AssessmentPageProps) {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang].assessment;
  const requested = (await searchParams).step;

  const draft = await getOpenDraft(userId);

  // Nothing started yet: the intro, or the results of the last finished one.
  if (!draft) {
    const sealed = await getLatestSealed(userId);
    if (requested === "results" && sealed) {
      redirect("/assessment/results");
    }
    return (
      <AssessmentShell lang={lang} navCopy={COPY[lang].nav} chrome="focus">
        <IntroStep action={startAssessment} copy={copy} />
      </AssessmentShell>
    );
  }

  // A grid begun on an earlier day is answering about a different week, so it
  // asks before either resuming or discarding.
  const today = todayInSaoPaulo();
  if (draft.takenAt !== today && requested !== "intro") {
    const next = firstUnanswered(draft.ratings);
    return (
      <AssessmentShell lang={lang} navCopy={COPY[lang].nav} chrome="focus">
        <ResumeStep
          restart={restartAssessment}
          resumeHref={assessmentStepHref(next ?? "results")}
          startedOn={formatShortDayMonth(draft.takenAt, lang)}
          answered={answeredCount(draft.ratings)}
          copy={copy}
        />
      </AssessmentShell>
    );
  }

  // The ceiling: backwards is free, forwards is not, and the results screen is
  // unreachable until the last domain is in.
  const step = resolveAssessmentStep(requested, draft.ratings);
  if (step === "results") redirect("/assessment/results");

  if (step === "intro") {
    return (
      <AssessmentShell lang={lang} navCopy={COPY[lang].nav} chrome="focus">
        <IntroStep action={startAssessment} copy={copy} />
      </AssessmentShell>
    );
  }

  if (!isDomainSlug(step)) redirect("/assessment");

  // The bar counts areas, not steps: the intro carries no bar, so starting the
  // count at the first domain is what makes "12 of 12" land on the last one.
  const areaNumber = domainPosition(step);

  return (
    <AssessmentShell lang={lang} navCopy={COPY[lang].nav} chrome="focus">
      <OnboardingProgress
        stepNumber={areaNumber}
        total={TOTAL_DOMAINS}
        label={format(copy.domainStep.eyebrow, {
          current: areaNumber,
          total: TOTAL_DOMAINS,
        })}
      />
      <DomainStep
        action={saveDomainRating}
        next={nextAssessmentHref(step)}
        backHref={prevAssessmentHref(step)}
        slug={step}
        isLast={areaNumber === TOTAL_DOMAINS}
        copy={copy}
        initial={draft.ratings[step] ?? {}}
      />
    </AssessmentShell>
  );
}

