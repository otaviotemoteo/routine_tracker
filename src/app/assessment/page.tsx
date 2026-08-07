import { redirect } from "next/navigation";
import { OnboardingProgress } from "@/components/onboarding/OnboardingChrome";
import { LanguageSelect } from "@/components/landing/LanguageSelect";
import { DomainStep } from "@/components/assessment/DomainStep";
import { IntroStep } from "@/components/assessment/IntroStep";
import { ResumeStep } from "@/components/assessment/ResumeStep";
import { restartAssessment, saveDomainRating, startAssessment } from "./actions";
import { getLatestSealed, getOpenDraft } from "@/db/assessment";
import {
  ASSESSMENT_STEPS,
  answeredCount,
  assessmentStepHref,
  assessmentStepNumber,
  firstUnanswered,
  nextAssessmentHref,
  prevAssessmentHref,
  resolveAssessmentStep,
  TOTAL_ASSESSMENT_STEPS,
} from "@/lib/assessment";
import { TOTAL_DOMAINS, isDomainSlug } from "@/lib/domains";
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
      <Shell lang={lang}>
        <IntroStep action={startAssessment} copy={copy} />
      </Shell>
    );
  }

  // A grid begun on an earlier day is answering about a different week, so it
  // asks before either resuming or discarding.
  const today = todayInSaoPaulo();
  if (draft.takenAt !== today && requested !== "intro") {
    const next = firstUnanswered(draft.ratings);
    return (
      <Shell lang={lang}>
        <ResumeStep
          restart={restartAssessment}
          resumeHref={assessmentStepHref(next ?? "results")}
          startedOn={formatShortDayMonth(draft.takenAt, lang)}
          answered={answeredCount(draft.ratings)}
          copy={copy}
        />
      </Shell>
    );
  }

  // The ceiling: backwards is free, forwards is not, and the results screen is
  // unreachable until the last domain is in.
  const step = resolveAssessmentStep(requested, draft.ratings);
  if (step === "results") redirect("/assessment/results");

  if (step === "intro") {
    return (
      <Shell lang={lang}>
        <IntroStep action={startAssessment} copy={copy} />
      </Shell>
    );
  }

  if (!isDomainSlug(step)) redirect("/assessment");

  const domainNumber = ASSESSMENT_STEPS.indexOf(step); // intro is 1, so this is the domain's own number
  const stepNumber = assessmentStepNumber(step);

  return (
    <Shell lang={lang}>
      <OnboardingProgress
        stepNumber={stepNumber}
        total={TOTAL_ASSESSMENT_STEPS}
        label={format(copy.stepOf, {
          current: stepNumber,
          total: TOTAL_ASSESSMENT_STEPS,
        })}
      />
      <DomainStep
        action={saveDomainRating}
        next={nextAssessmentHref(step)}
        backHref={prevAssessmentHref(step)}
        slug={step}
        stepNumber={domainNumber}
        totalDomains={TOTAL_DOMAINS}
        isLast={domainNumber === TOTAL_DOMAINS}
        copy={copy}
        initial={draft.ratings[step] ?? {}}
      />
    </Shell>
  );
}

function Shell({
  lang,
  children,
}: {
  lang: "en" | "pt";
  children: React.ReactNode;
}) {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-24">
      <div className="flex justify-end mb-4">
        <LanguageSelect current={lang} />
      </div>
      {children}
    </main>
  );
}
