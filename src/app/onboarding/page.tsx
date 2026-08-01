import { OnboardingProgress } from "@/components/onboarding/OnboardingChrome";
import { WelcomeStep } from "@/components/onboarding/WelcomeStep";
import { WorkoutStep } from "@/components/onboarding/WorkoutStep";
import { ReadingStep } from "@/components/onboarding/ReadingStep";
import { SleepStep } from "@/components/onboarding/SleepStep";
import { RoutineStep } from "@/components/onboarding/RoutineStep";
import { DuolingoStep } from "@/components/onboarding/DuolingoStep";
import { SpiritualityStep } from "@/components/onboarding/SpiritualityStep";
import { ReviewStep } from "@/components/onboarding/ReviewStep";
import { LanguageSelect } from "@/components/landing/LanguageSelect";
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
import { getSetupSummary } from "@/lib/setup-summary";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

interface OnboardingPageProps {
  searchParams: Promise<{ step?: string }>;
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang].onboarding;
  const step = resolveStep((await searchParams).step);
  const num = stepNumber(step);
  const progressLabel = format(copy.stepOf, { current: num, total: TOTAL_STEPS });

  const next = stepHref(nextStep(step));
  const back = stepHref(prevStep(step));
  const submit = copy.continue;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-24">
      {/* No NavBar on this route, so the language toggle lives here. */}
      <div className="flex justify-end mb-4">
        <LanguageSelect current={lang} />
      </div>
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
          {...(await workoutInitial(userId))}
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
          {...(await readingInitial(userId))}
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
          {...(await sleepInitial(userId))}
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
          initialBlocks={await routineInitial(userId)}
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
          initialLanguages={await duolingoInitial(userId)}
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
          initialPractices={await spiritualityInitial(userId)}
        />
      )}

      {step === "review" && (
        <ReviewStep
          copy={copy}
          backHref={back}
          rows={(await getSetupSummary(userId, copy)).map((row) => ({
            label: row.label,
            value: row.value,
            editHref: stepHref(row.section),
          }))}
        />
      )}
    </main>
  );
}
