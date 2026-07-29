import { TodayBoard } from "@/components/TodayBoard";
import { getDayChecks, getTodayContext } from "@/db/queries";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { getSetupSummary } from "@/lib/setup-summary";
import { formatDayLong, todayInSaoPaulo } from "@/lib/utils";

// Always render with the current São Paulo day — never cache a stale "today".
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const lang = await getLang();
  const copy = COPY[lang];
  const today = todayInSaoPaulo();
  const [checks, context, setup] = await Promise.all([
    getDayChecks(today),
    getTodayContext(today),
    getSetupSummary(copy.onboarding, copy.today),
  ]);

  // Same source as the Overview note, so the two never disagree. Only the
  // healthy "here's your pace" case belongs on the card.
  const reading = setup.find((row) => row.section === "reading");
  const paceNote = reading?.hintTone === "info" ? reading.hint : undefined;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <p className="eyebrow">{formatDayLong(today, lang)}</p>
      <TodayBoard
        checks={checks}
        context={context}
        title={copy.today.title}
        lang={lang}
        copy={copy.today}
        dailyCopy={copy.daily}
        readingCopy={copy.onboarding.reading}
        paceNote={paceNote}
      />
    </main>
  );
}
