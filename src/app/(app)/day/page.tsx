import { notFound } from "next/navigation";
import { OnboardingProgress } from "@/components/onboarding/OnboardingChrome";
import { DailyStep } from "@/components/daily/DailyStep";
import { DailyIndex } from "@/components/daily/DailyIndex";
import { getDayChecks, getTodayContext } from "@/db/queries";
import { getLang } from "@/lib/get-lang";
import { COPY, format } from "@/lib/i18n";
import {
  dailyStepNumber,
  nextDailyHref,
  prevDailyHref,
  resolveDailyStep,
  TOTAL_DAILY_STEPS,
} from "@/lib/daily";
import { todayInSaoPaulo } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface DayPageProps {
  searchParams: Promise<{ step?: string }>;
}

// The guided "Complete daily" flow: one habit per step, prefilled from the
// user's configured goals (same mechanics as the onboarding wizard).
export default async function DayPage({ searchParams }: DayPageProps) {
  const lang = await getLang();
  const copy = COPY[lang];
  const today = todayInSaoPaulo();
  const rawStep = (await searchParams).step;

  const [checks, context] = await Promise.all([
    getDayChecks(today),
    getTodayContext(today),
  ]);

  // No step named: show the day's areas so the user can pick what's left
  // (or revisit something already logged) instead of walking all seven.
  if (!rawStep) {
    const allDone = checks.every((c) => c.done);
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <p className="eyebrow">{copy.daily.eyebrow}</p>
        <h1 className="display-title text-3xl sm:text-4xl mt-2 mb-2">
          {copy.daily.indexTitle}
        </h1>
        <p className="opacity-75 mb-6">
          {allDone ? copy.daily.allDone : copy.daily.indexLead}
        </p>
        <DailyIndex
          checks={checks}
          context={context}
          lang={lang}
          copy={copy.daily}
          todayCopy={copy.today}
        />
      </main>
    );
  }

  const step = resolveDailyStep(rawStep);
  const check = checks.find((c) => c.slug === step);
  if (!check) notFound();

  const num = dailyStepNumber(step);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <OnboardingProgress
        stepNumber={num}
        total={TOTAL_DAILY_STEPS}
        label={`${copy.daily.eyebrow} · ${format(copy.daily.stepOf, {
          current: num,
          total: TOTAL_DAILY_STEPS,
        })}`}
      />
      <DailyStep
        key={check.id}
        check={check}
        context={context}
        lang={lang}
        copy={copy.daily}
        sheetCopy={copy.sheets}
        nextHref={nextDailyHref(step)}
        backHref={prevDailyHref(step)}
        isLast={num === TOTAL_DAILY_STEPS}
      />
    </main>
  );
}
