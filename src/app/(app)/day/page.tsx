import { notFound } from "next/navigation";
import { OnboardingProgress } from "@/components/onboarding/OnboardingChrome";
import { DailyStep } from "@/components/daily/DailyStep";
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
  const step = resolveDailyStep((await searchParams).step);

  const [checks, context] = await Promise.all([
    getDayChecks(today),
    getTodayContext(today),
  ]);
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
