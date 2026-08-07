import Link from "next/link";
import { ViewToggle } from "@/components/overview/ViewToggle";
import { PeriodHeader } from "@/components/overview/PeriodHeader";
import { WeekGrid } from "@/components/overview/WeekGrid";
import { MonthCalendar } from "@/components/overview/MonthCalendar";
import { ConsistencyPanel } from "@/components/overview/ConsistencyPanel";
import { StatCards, type StatCard } from "@/components/overview/StatCards";
import { ActivitiesSection } from "@/components/ActivitiesSection";
import { ValuesCard } from "@/components/assessment/ValuesCard";
import { getSetupSummary } from "@/lib/setup-summary";
import {
  getMonthData,
  getMonthDetailStats,
  getMonthDoneCounts,
  getMonthMatrix,
  getTrackingStart,
  getWeekData,
} from "@/db/queries";
import { getLang } from "@/lib/get-lang";
import { requireUserId } from "@/lib/session";
import { COPY, format, habitName, type Lang } from "@/lib/i18n";
import {
  addDays,
  addMonths,
  formatMonthLabel,
  formatShortDayMonth,
  todayInSaoPaulo,
  weekStartMonday,
} from "@/lib/utils";
import type { WeekData } from "@/types/habit";

export const dynamic = "force-dynamic";

interface OverviewPageProps {
  searchParams: Promise<{ view?: string; period?: string }>;
}

// Overview absorbs the former /semana and /mes as a Week | Month toggle held in
// the URL (?view=&period=), deep-linkable and server-rendered — the toggle and
// period nav are plain <Link>s, so switching is a client transition, never a
// full reload.
export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang];
  const today = todayInSaoPaulo();
  const { view: rawView, period } = await searchParams;
  const view = rawView === "month" ? "month" : "week";

  // Also feeds the week's reading card, so the pages/day it reports is measured
  // against the same target the reading dialog explains.
  const [setup, trackingStart] = await Promise.all([
    getSetupSummary(userId, copy.onboarding, copy.today),
    getTrackingStart(userId),
  ]);
  const paceGoal = setup.find((row) => row.section === "reading")?.paceValues
    ?.perDay;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <p className="eyebrow">{copy.overview.eyebrow}</p>
      <h1 className="display-title text-4xl sm:text-5xl mt-2 mb-5">
        {copy.overview.title}
      </h1>

      <ViewToggle view={view} copy={copy.overview} />

      {view === "week" ? (
        <WeekView
          userId={userId}
          lang={lang}
          copy={copy}
          today={today}
          period={period}
          paceGoal={paceGoal}
          trackingStart={trackingStart}
        />
      ) : (
        <MonthView
          userId={userId}
          lang={lang}
          copy={copy}
          today={today}
          period={period}
          trackingStart={trackingStart}
        />
      )}

      {/* The same question at a different timescale: the views above cover
          this week and this month, this covers the half-year. */}
      <ValuesCard userId={userId} lang={lang} copy={copy.assessment} />

      {/* Editable setup, below the frequency views. */}
      <ActivitiesSection
        rows={setup}
        copy={copy.today}
        readingCopy={copy.onboarding.reading}
      />
    </main>
  );
}

// Week's three takeaways: the strongest day, the habit that needs attention,
// and how the grid's own numbers add up.
function weekCards(
  week: WeekData,
  today: string,
  lang: Lang,
  copy: (typeof COPY)[Lang],
  paceGoal?: number
): StatCard[] {
  const cards: StatCard[] = [];
  const required = week.habits.filter((h) => !h.optional);
  const elapsed = week.days.filter((d) => d <= today).length;

  if (elapsed > 0 && required.length > 0) {
    const perDay = week.days.map(
      (_, i) => required.filter((h) => h.cells[i].done).length
    );
    let best = 0;
    for (let i = 1; i < elapsed; i++) if (perDay[i] > perDay[best]) best = i;
    cards.push({
      label: copy.overview.bestDay,
      value: copy.overview.weekdaysLong[best],
      note: format(copy.overview.bestDayNote, {
        done: perDay[best],
        total: required.length,
      }),
    });

    const weakest = [...required].sort((a, b) => a.percent - b.percent)[0];
    const weakDone = weakest.cells.filter((c) => c.done).length;
    cards.push({
      label: copy.overview.weakest,
      value: habitName(lang, weakest.slug, weakest.name),
      note: format(copy.overview.weakestNote, {
        done: weakDone,
        total: elapsed,
      }),
      tone: "warn",
    });
  }

  const reading = week.habits.find((h) => h.slug === "leitura");
  if (reading) {
    const pages = reading.cells.reduce(
      (sum, cell) => sum + (Number.parseInt(cell.value ?? "", 10) || 0),
      0
    );
    const perDay = elapsed > 0 ? Math.round(pages / elapsed) : 0;
    cards.push({
      label: copy.overview.readingCard,
      value: format(copy.overview.readingPages, { n: pages }),
      note:
        paceGoal === undefined
          ? format(copy.overview.recordsAvg, { n: perDay })
          : format(copy.overview.readingPerDay, { perDay, goal: paceGoal }),
      tone: paceGoal !== undefined && perDay < paceGoal ? "warn" : "neutral",
    });
  }

  return cards;
}

async function WeekView({
  userId,
  lang,
  copy,
  today,
  period,
  paceGoal,
  trackingStart,
}: {
  userId: number;
  lang: Lang;
  copy: (typeof COPY)[Lang];
  today: string;
  period?: string;
  paceGoal?: number;
  trackingStart: string | null;
}) {
  const currentStart = weekStartMonday(today);
  const start =
    period && /^\d{4}-\d{2}-\d{2}$/.test(period) && !Number.isNaN(Date.parse(period))
      ? weekStartMonday(period)
      : currentStart;
  const week = await getWeekData(userId, start);
  const label = `${formatShortDayMonth(start, lang)} – ${formatShortDayMonth(addDays(start, 6), lang)}`;

  // Adherence counts only the days inside the record — a Tuesday shouldn't
  // read as 28% because Wednesday hasn't arrived, and the days before the very
  // first check were never missed.
  const required = week.habits.filter((h) => !h.optional);
  const slots = required.length * week.countedDays;
  const done = required.reduce(
    (sum, h) => sum + h.cells.filter((c, i) => c.done && week.tracked[i]).length,
    0
  );
  const adherence = slots === 0 ? 0 : Math.round((done / slots) * 100);
  const empty = week.habits.every((h) => h.done.every((d) => !d));
  // Nothing to walk into: the week after this one hasn't started, and there
  // are no records before the first.
  const nextStart = addDays(start, 7);
  const prevEnd = addDays(start, -1);

  return (
    <div className="flex flex-col gap-5">
      <PeriodHeader
        eyebrow={label.toUpperCase()}
        title={
          start === currentStart ? copy.overview.weekTitle : copy.week.title
        }
        stats={[
          {
            value: `${adherence}`,
            suffix: "%",
            label: copy.overview.adherence,
            tone: adherence >= 70 ? "clover" : "straw",
          },
          {
            value: `${done}/${slots}`,
            label: copy.overview.recordsDone,
          },
        ]}
        prevHref={
          trackingStart && prevEnd < trackingStart
            ? undefined
            : `/overview?view=week&period=${addDays(start, -7)}`
        }
        nextHref={
          nextStart > today
            ? undefined
            : `/overview?view=week&period=${nextStart}`
        }
        prevAriaLabel={copy.week.prevAria}
        nextAriaLabel={copy.week.nextAria}
        currentLabel={copy.week.current}
        currentHref={start !== currentStart ? "/overview?view=week" : undefined}
      />
      {empty && (
        <p className="text-sm opacity-75">
          {copy.week.emptyPre}{" "}
          <Link href="/" className="font-semibold underline">
            {copy.week.emptyLink}
          </Link>{" "}
          {copy.week.emptyPost}
        </p>
      )}
      <WeekGrid
        week={week}
        today={today}
        lang={lang}
        copy={copy.week}
        overviewCopy={copy.overview}
        dayNames={copy.overview.weekdaysLong}
        optionalLabel={copy.month.optional}
      />
      {!empty && (
        <StatCards cards={weekCards(week, today, lang, copy, paceGoal)} />
      )}
    </div>
  );
}

async function MonthView({
  userId,
  lang,
  copy,
  today,
  period,
  trackingStart,
}: {
  userId: number;
  lang: Lang;
  copy: (typeof COPY)[Lang];
  today: string;
  period?: string;
  trackingStart: string | null;
}) {
  const currentMonth = today.slice(0, 7);
  const month =
    period && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? period : currentMonth;
  const [data, stats, matrix, previous] = await Promise.all([
    getMonthData(userId, month, today),
    getMonthDetailStats(userId, month),
    getMonthMatrix(userId, month),
    getMonthDoneCounts(userId, addMonths(month, -1)),
  ]);

  const required = data.habits.filter((h) => !h.optional);
  const elapsed = matrix.countedDays;
  const slots = required.length * elapsed;
  const done = required.reduce((sum, h) => sum + h.doneCount, 0);
  const adherence = slots === 0 ? 0 : Math.round((done / slots) * 100);
  // "Almost every habit" is the encouraging measure the calendar's heat is
  // built around; strict 6-of-6 days are already visible as the darkest cells.
  const goodDayFloor = Math.max(1, matrix.requiredCount - 1);
  const goodDays = matrix.days.filter(
    (d) => d.tracked && d.doneCount >= goodDayFloor
  ).length;
  const empty = data.habits.every((h) => h.doneCount === 0);

  const weakest = [...required].sort((a, b) => a.percent - b.percent)[0];
  const cards: StatCard[] = [
    {
      label: copy.overview.readingCard,
      value: format(copy.overview.readingPages, { n: stats.reading.totalPages }),
      note: format(copy.overview.recordsAvg, {
        n: elapsed === 0 ? 0 : Math.round(stats.reading.totalPages / elapsed),
      }),
    },
    {
      label: copy.overview.avgSleepCard,
      value:
        stats.sleep.avgHours === null
          ? "—"
          : `${Math.floor(stats.sleep.avgHours)}h${String(
              Math.round((stats.sleep.avgHours % 1) * 60)
            ).padStart(2, "0")}`,
      note: format(copy.overview.nightsLogged, { n: stats.sleep.nights }),
    },
  ];
  if (weakest) {
    cards.push({
      label: copy.overview.weakest,
      value: habitName(lang, weakest.slug, weakest.name),
      note: format(copy.overview.weakestNote, {
        done: weakest.doneCount,
        total: weakest.countedDays,
      }),
      tone: "warn",
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PeriodHeader
        eyebrow={`${formatMonthLabel(month, lang).toUpperCase()} · ${format(
          copy.overview.monthDays,
          { n: matrix.days.length }
        ).toUpperCase()}`}
        title={
          month === currentMonth ? copy.overview.monthTitle : copy.month.title
        }
        stats={[
          {
            value: `${adherence}`,
            suffix: "%",
            label: copy.overview.adherence,
            tone: adherence >= 70 ? "clover" : "straw",
          },
          {
            value: `${goodDays}`,
            label: format(copy.overview.daysAtLeast, { min: goodDayFloor }),
          },
        ]}
        prevHref={
          trackingStart && addMonths(month, -1) < trackingStart.slice(0, 7)
            ? undefined
            : `/overview?view=month&period=${addMonths(month, -1)}`
        }
        nextHref={
          addMonths(month, 1) > currentMonth
            ? undefined
            : `/overview?view=month&period=${addMonths(month, 1)}`
        }
        prevAriaLabel={copy.month.prevAria}
        nextAriaLabel={copy.month.nextAria}
        currentLabel={copy.month.current}
        currentHref={month !== currentMonth ? "/overview?view=month" : undefined}
      />
      {empty && (
        <p className="text-sm opacity-75">
          {copy.month.emptyPre}{" "}
          <Link href="/" className="font-semibold underline">
            {copy.month.emptyLink}
          </Link>{" "}
          {copy.month.emptyPost}
        </p>
      )}
      <MonthCalendar
        matrix={matrix}
        today={today}
        lang={lang}
        copy={copy.overview}
        dayLabels={copy.week.dayLabels}
        dayNames={copy.overview.weekdaysLong}
      />
      <ConsistencyPanel
        habits={data.habits}
        previous={previous}
        comparable={
          !trackingStart || addMonths(month, -1) >= trackingStart.slice(0, 7)
        }
        lang={lang}
        copy={copy.overview}
      />
      {!empty && <StatCards cards={cards} />}
    </div>
  );
}
