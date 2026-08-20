import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OnboardingProgress } from "@/components/onboarding/OnboardingChrome";
import { DailyStep } from "@/components/daily/DailyStep";
import { DailyIndex } from "@/components/daily/DailyIndex";
import { getDayChecks, getTodayContext } from "@/db/queries";
import { getLang } from "@/lib/get-lang";
import { COPY, format } from "@/lib/i18n";
import { EMPTY_ACTIVITY_CONTEXT } from "@/types/habit";
import {
  dailyStepNumber,
  nextDailyHref,
  prevDailyHref,
  resolveDailyStep,
} from "@/lib/daily";
import { todayInSaoPaulo } from "@/lib/utils";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

interface DayPageProps {
  searchParams: Promise<{ step?: string }>;
}

// The guided "Complete daily" flow: one habit per step, prefilled from the
// user's configured goals (same mechanics as the onboarding wizard).
export default async function DayPage({ searchParams }: DayPageProps) {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang];
  const today = todayInSaoPaulo();
  const rawStep = (await searchParams).step;

  const [checks, context] = await Promise.all([
    getDayChecks(userId, today),
    getTodayContext(userId, today),
  ]);

  // The flow is whatever this person tracks, in their habit order — not a
  // fixed seven. An account with no habits has no flow to walk.
  const slugs = checks.map((c) => c.slug);
  if (slugs.length === 0) redirect("/habits");

  // No step named: show the day's areas so the user can pick what's left
  // (or revisit something already logged) instead of walking every one.
  if (!rawStep) {
    const allDone = checks.every((c) => c.done);
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <p className="eyebrow">{copy.daily.eyebrow}</p>
        <h1 className="display-title text-3xl sm:text-4xl mt-2 mb-2 flex items-center gap-3">
          <Link
            href="/"
            aria-label={copy.daily.back}
            className="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2"
          >
            <ArrowLeft className="w-7 h-7" aria-hidden />
          </Link>
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

  const step = resolveDailyStep(rawStep, slugs);
  const check = step ? checks.find((c) => c.slug === step) : undefined;
  if (!step || !check) notFound();

  const num = dailyStepNumber(step, slugs);
  const total = slugs.length;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <OnboardingProgress
        stepNumber={num}
        total={total}
        label={`${copy.daily.eyebrow} · ${format(copy.daily.stepOf, {
          current: num,
          total,
        })}`}
      />
      <DailyStep
        key={check.id}
        check={check}
        context={context.activities[check.activityId] ?? EMPTY_ACTIVITY_CONTEXT}
        lang={lang}
        copy={copy.daily}
        sheetCopy={copy.sheets}
        nextHref={nextDailyHref(step, slugs)}
        backHref={prevDailyHref(step, slugs)}
        isLast={num === total}
      />
    </main>
  );
}
