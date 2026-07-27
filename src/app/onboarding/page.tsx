import { OnboardingProgress } from "@/components/onboarding/OnboardingChrome";
import { WelcomeStep } from "@/components/onboarding/WelcomeStep";
import { WorkoutStep } from "@/components/onboarding/WorkoutStep";
import { ReadingStep } from "@/components/onboarding/ReadingStep";
import { SleepStep } from "@/components/onboarding/SleepStep";
import { RoutineStep } from "@/components/onboarding/RoutineStep";
import { DuolingoStep } from "@/components/onboarding/DuolingoStep";
import { SpiritualityStep } from "@/components/onboarding/SpiritualityStep";
import { ReviewStep, type ReviewRow } from "@/components/onboarding/ReviewStep";
import {
  getActiveWorkoutPlan,
  getReadingGoal,
  getSleepTarget,
  listLanguages,
  listRoutineBlocks,
  listSpiritualPractices,
} from "@/db/queries";
import {
  saveDuolingoStep,
  saveReadingStep,
  saveRoutineStep,
  saveSpiritualityStep,
  saveWorkoutStep,
  saveSleepStep,
} from "@/app/onboarding/actions";
import { getLang } from "@/lib/get-lang";
import { COPY, format } from "@/lib/i18n";
import {
  nextStep,
  prevStep,
  resolveStep,
  stepHref,
  stepNumber,
  TOTAL_STEPS,
} from "@/lib/onboarding";
import {
  duolingoInitial,
  readingInitial,
  routineInitial,
  sleepInitial,
  spiritualityInitial,
  workoutInitial,
} from "@/lib/onboarding-prefill";
import { todayInSaoPaulo } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface OnboardingPageProps {
  searchParams: Promise<{ step?: string }>;
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const lang = await getLang();
  const copy = COPY[lang].onboarding;
  const step = resolveStep((await searchParams).step);
  const num = stepNumber(step);
  const progressLabel = format(copy.stepOf, { current: num, total: TOTAL_STEPS });

  const next = stepHref(nextStep(step));
  const back = stepHref(prevStep(step));
  const submit = copy.continue;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <OnboardingProgress stepNumber={num} total={TOTAL_STEPS} label={progressLabel} />

      {step === "welcome" && (
        <WelcomeStep
          copy={copy}
          startHref={stepHref("workout")}
          skipHref={stepHref("review")}
        />
      )}

      {step === "workout" && (
        <WorkoutStep
          action={saveWorkoutStep}
          next={next}
          backHref={back}
          skipHref={next}
          submitLabel={submit}
          copy={copy}
          {...(await workoutInitial())}
        />
      )}

      {step === "reading" && (
        <ReadingStep
          action={saveReadingStep}
          next={next}
          backHref={back}
          skipHref={next}
          submitLabel={submit}
          copy={copy}
          {...(await readingInitial())}
        />
      )}

      {step === "sleep" && (
        <SleepStep
          action={saveSleepStep}
          next={next}
          backHref={back}
          skipHref={next}
          submitLabel={submit}
          copy={copy}
          {...(await sleepInitial())}
        />
      )}

      {step === "routine" && (
        <RoutineStep
          action={saveRoutineStep}
          next={next}
          backHref={back}
          skipHref={next}
          submitLabel={submit}
          copy={copy}
          initialBlocks={await routineInitial()}
        />
      )}

      {step === "duolingo" && (
        <DuolingoStep
          action={saveDuolingoStep}
          next={next}
          backHref={back}
          skipHref={next}
          submitLabel={submit}
          copy={copy}
          initialLanguages={await duolingoInitial()}
        />
      )}

      {step === "spirituality" && (
        <SpiritualityStep
          action={saveSpiritualityStep}
          next={next}
          backHref={back}
          skipHref={next}
          submitLabel={submit}
          copy={copy}
          initialPractices={await spiritualityInitial()}
        />
      )}

      {step === "review" && (
        <ReviewStep copy={copy} backHref={back} rows={await reviewRows(copy)} />
      )}
    </main>
  );
}

async function reviewRows(
  copy: (typeof COPY)[keyof typeof COPY]["onboarding"]
): Promise<ReviewRow[]> {
  const [plan, goal, sleep, routine, langs, practices] = await Promise.all([
    getActiveWorkoutPlan(),
    getReadingGoal(Number(todayInSaoPaulo().slice(0, 4))),
    getSleepTarget(),
    listRoutineBlocks(),
    listLanguages(),
    listSpiritualPractices(),
  ]);
  return [
    {
      label: copy.review.sections.workout,
      value: plan ? plan.name : null,
      editHref: stepHref("workout"),
    },
    {
      label: copy.review.sections.reading,
      value: goal ? `${goal.targetBooks} ${copy.reading.goalUnit}` : null,
      editHref: stepHref("reading"),
    },
    {
      label: copy.review.sections.sleep,
      value: sleep ? `${sleep.bedtime.slice(0, 5)} – ${sleep.wakeTime.slice(0, 5)}` : null,
      editHref: stepHref("sleep"),
    },
    {
      label: copy.review.sections.routine,
      value: routine.length
        ? routine.map((b) => b.activity).slice(0, 3).join(", ")
        : null,
      editHref: stepHref("routine"),
    },
    {
      label: copy.review.sections.duolingo,
      value: langs.length ? langs.map((l) => l.name).join(", ") : null,
      editHref: stepHref("duolingo"),
    },
    {
      label: copy.review.sections.spirituality,
      value: practices.length ? practices.map((p) => p.name).join(", ") : null,
      editHref: stepHref("spirituality"),
    },
  ];
}
