import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { WorkoutStep } from "@/components/onboarding/WorkoutStep";
import { ReadingStep } from "@/components/onboarding/ReadingStep";
import { SleepStep } from "@/components/onboarding/SleepStep";
import { RoutineStep } from "@/components/onboarding/RoutineStep";
import { DuolingoStep } from "@/components/onboarding/DuolingoStep";
import { SpiritualityStep } from "@/components/onboarding/SpiritualityStep";
import { LanguageSelect } from "@/components/landing/LanguageSelect";
import { getSetupSummary } from "@/lib/setup-summary";
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
  searchParams: Promise<{ section?: string; from?: string }>;
}

// Reuses the onboarding step components. Both Back and Save return wherever
// the edit was entered from — the Config list by default, or Overview when
// reached from its Activities section (`?from=overview`) — since that's the
// screen the change is meant to be seen on. The same server actions write.
export default async function ConfigPage({ searchParams }: ConfigPageProps) {
  const lang = await getLang();
  const copy = COPY[lang].onboarding;
  const { section: raw, from } = await searchParams;
  const section = SECTIONS.includes(raw as Section) ? (raw as Section) : null;

  const origin = from === "overview" ? "/overview" : "/config";
  const back = origin;
  const next = origin;
  const submit = copy.save;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-24">
      {/* No NavBar on this route, so the language toggle lives here. */}
      <div className="flex justify-end mb-4">
        <LanguageSelect current={lang} />
      </div>
      {section === null ? (
        <>
          <p className="eyebrow">{copy.config.eyebrow}</p>
          <h1 className="display-title text-4xl sm:text-5xl mt-2 mb-5">
            {copy.config.title}
          </h1>
          <p className="opacity-75 mb-6">{copy.config.lead}</p>
          <ul className="flex flex-col gap-3 list-none">
            {(await getSetupSummary(copy)).map((row) => (
              <li key={row.section}>
                <Link
                  href={`/config?section=${row.section}`}
                  className="min-h-[64px] flex items-center justify-between gap-3 px-5 py-3 rounded-card border-2 border-forest bg-white shadow-hard hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg transition-[transform,box-shadow] duration-150"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{row.label}</span>
                    <span
                      className={`block text-sm truncate ${
                        row.value ? "opacity-75" : "opacity-50"
                      }`}
                    >
                      {row.value ?? copy.review.notSet}
                    </span>
                  </span>
                  <ChevronRight className="w-5 h-5 shrink-0" aria-hidden />
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
              requireDirtyToSave
              titleBackHref={origin}
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
              requireDirtyToSave
              titleBackHref={origin}
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
              requireDirtyToSave
              titleBackHref={origin}
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
              requireDirtyToSave
              titleBackHref={origin}
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
              requireDirtyToSave
              titleBackHref={origin}
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
              requireDirtyToSave
              titleBackHref={origin}
              initialPractices={await spiritualityInitial()}
            />
          )}
        </>
      )}
    </main>
  );
}
