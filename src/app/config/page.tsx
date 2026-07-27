import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { WorkoutStep } from "@/components/onboarding/WorkoutStep";
import { ReadingStep } from "@/components/onboarding/ReadingStep";
import { SleepStep } from "@/components/onboarding/SleepStep";
import { RoutineStep } from "@/components/onboarding/RoutineStep";
import { DuolingoStep } from "@/components/onboarding/DuolingoStep";
import { SpiritualityStep } from "@/components/onboarding/SpiritualityStep";
import {
  saveDuolingoStep,
  saveReadingStep,
  saveRoutineStep,
  saveSleepStep,
  saveSpiritualityStep,
  saveWorkoutStep,
} from "@/app/onboarding/actions";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import {
  duolingoInitial,
  readingInitial,
  routineInitial,
  sleepInitial,
  spiritualityInitial,
  workoutInitial,
} from "@/lib/onboarding-prefill";

export const dynamic = "force-dynamic";

const SECTIONS = [
  "workout",
  "reading",
  "sleep",
  "routine",
  "duolingo",
  "spirituality",
] as const;
type Section = (typeof SECTIONS)[number];

interface ConfigPageProps {
  searchParams: Promise<{ section?: string }>;
}

// Reuses the onboarding step components. `next="/config"` makes each step save
// and return here instead of advancing a wizard; the same server actions write.
export default async function ConfigPage({ searchParams }: ConfigPageProps) {
  const lang = await getLang();
  const copy = COPY[lang].onboarding;
  const raw = (await searchParams).section;
  const section = SECTIONS.includes(raw as Section) ? (raw as Section) : null;

  const back = "/config";
  const next = "/config";
  const submit = copy.save;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <p className="eyebrow">{copy.config.eyebrow}</p>
      <h1 className="display-title text-4xl sm:text-5xl mt-2 mb-5">
        {copy.config.title}
      </h1>

      {section === null ? (
        <>
          <p className="opacity-75 mb-6">{copy.config.lead}</p>
          <ul className="flex flex-col gap-3 list-none">
            {SECTIONS.map((s) => (
              <li key={s}>
                <Link
                  href={`/config?section=${s}`}
                  className="min-h-[56px] flex items-center justify-between px-5 rounded-card border-2 border-forest bg-white shadow-hard font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg transition-[transform,box-shadow] duration-150"
                >
                  {copy.review.sections[s]}
                  <ChevronRight className="w-5 h-5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-1.5 font-semibold text-sm underline min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            {copy.back}
          </Link>
        </>
      ) : (
        <>
          {section === "workout" && (
            <WorkoutStep
              action={saveWorkoutStep}
              next={next}
              backHref={back}
              submitLabel={submit}
              copy={copy}
              {...(await workoutInitial())}
            />
          )}
          {section === "reading" && (
            <ReadingStep
              action={saveReadingStep}
              next={next}
              backHref={back}
              submitLabel={submit}
              copy={copy}
              {...(await readingInitial())}
            />
          )}
          {section === "sleep" && (
            <SleepStep
              action={saveSleepStep}
              next={next}
              backHref={back}
              submitLabel={submit}
              copy={copy}
              {...(await sleepInitial())}
            />
          )}
          {section === "routine" && (
            <RoutineStep
              action={saveRoutineStep}
              next={next}
              backHref={back}
              submitLabel={submit}
              copy={copy}
              initialBlocks={await routineInitial()}
            />
          )}
          {section === "duolingo" && (
            <DuolingoStep
              action={saveDuolingoStep}
              next={next}
              backHref={back}
              submitLabel={submit}
              copy={copy}
              initialLanguages={await duolingoInitial()}
            />
          )}
          {section === "spirituality" && (
            <SpiritualityStep
              action={saveSpiritualityStep}
              next={next}
              backHref={back}
              submitLabel={submit}
              copy={copy}
              initialPractices={await spiritualityInitial()}
            />
          )}
        </>
      )}
    </main>
  );
}
