import { TodayBoard } from "@/components/TodayBoard";
import { getDayChecks, getDayStreak, getTodayContext } from "@/db/queries";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { getSetupSummary } from "@/lib/setup-summary";
import { forecastFinishDate } from "@/lib/today-card";
import { formatDayLong, todayInSaoPaulo } from "@/lib/utils";

// Always render with the current São Paulo day — never cache a stale "today".
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const lang = await getLang();
  const copy = COPY[lang];
  const today = todayInSaoPaulo();
  const [checks, context, setup, streak] = await Promise.all([
    getDayChecks(today),
    getTodayContext(today),
    getSetupSummary(copy.onboarding, copy.today),
    getDayStreak(today),
  ]);

  // Same source as the Overview note, so the two never disagree. Only the
  // healthy "here's your pace" case belongs on the card.
  const reading = setup.find((row) => row.section === "reading");
  const paceValues =
    reading?.hintTone === "info" ? reading.paceValues : undefined;
  const pace = paceValues
    ? {
        perDay: paceValues.perDay,
        forecast: forecastFinishDate(
          paceValues.currentBookLeft,
          paceValues.perDay,
          lang
        ),
      }
    : undefined;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <TodayBoard
        checks={checks}
        context={context}
        title={copy.today.title}
        eyebrow={formatDayLong(today, lang)}
        streak={streak}
        lang={lang}
        copy={copy.today}
        dailyCopy={copy.daily}
        readingCopy={copy.onboarding.reading}
        pace={pace}
        paceValues={paceValues}
      />
    </main>
  );
}
