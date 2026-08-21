import { TodayBoard } from "@/components/TodayBoard";
import { TemplatesNudge } from "@/components/today/TemplatesNudge";
import {
  getDayChecks,
  getDayStreak,
  getTodayComparisons,
  getTodayContext,
} from "@/db/queries";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { getSetupSummary } from "@/lib/setup-summary";
import { forecastFinishDate } from "@/lib/today-card";
import { formatDayLong, todayInSaoPaulo } from "@/lib/utils";
import { requireUserId } from "@/lib/session";

// Always render with the current São Paulo day — never cache a stale "today".
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang];
  const today = todayInSaoPaulo();
  const [checks, context, setup, streak, comparisons] = await Promise.all([
    getDayChecks(userId, today),
    getTodayContext(userId, today),
    getSetupSummary(userId, copy.onboarding, copy.today),
    getDayStreak(userId, today),
    getTodayComparisons(userId, today),
  ]);

  // Same source as the Overview note, so the two never disagree. Only the
  // healthy "here's your pace" case belongs on the card.
  const reading = setup.find((row) => row.templateKind === "leitura");
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

  // First-run nudge into the card-style chooser: only when there's a real
  // board to show (an empty Today has its own, different empty state).
  // Derived purely from whether any tracked activity is still the bare,
  // untouched default — no dismiss-once cookie any more. A one-time
  // dismissal meant "Choose templates" and "Not now" both permanently hid
  // the nudge even if only some habits got a real template, which is
  // exactly the state that must not be reachable: an untouched card must
  // not be visible until it's actually been given a template, not just
  // until someone closed the banner once.
  const uncustomized = checks.filter((c) => c.templateKind === null);
  const showTemplatesNudge = checks.length > 0 && uncustomized.length > 0;
  // BUG-2: the nudge already lists these by name — their default cards must
  // not ALSO render behind it. Still counted toward progress (TodayBoard's
  // own `checks` stays the full list); only the grid excludes them.
  const hideFromGrid = showTemplatesNudge
    ? new Set(uncustomized.map((c) => c.id))
    : undefined;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <TodayBoard
        checks={checks}
        context={context}
        title={copy.today.title}
        eyebrow={formatDayLong(today, lang)}
        streak={streak}
        today={today}
        comparisons={comparisons}
        lang={lang}
        copy={copy.today}
        dailyCopy={copy.daily}
        readingCopy={copy.onboarding.reading}
        pace={pace}
        paceValues={paceValues}
        templatesNudge={
          showTemplatesNudge && (
            <TemplatesNudge habitNames={uncustomized} lang={lang} copy={copy.today} />
          )
        }
        hideFromGrid={hideFromGrid}
      />
    </main>
  );
}
