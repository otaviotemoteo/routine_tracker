import Link from "next/link";
import { PeriodNav } from "@/components/PeriodNav";
import { WeekGrid } from "@/components/WeekGrid";
import { MonthProgress } from "@/components/MonthProgress";
import { MonthSummary } from "@/components/MonthSummary";
import {
  getMonthData,
  getMonthDetailStats,
  getWeekData,
  listLanguages,
} from "@/db/queries";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import {
  addDays,
  addMonths,
  formatMonthLabel,
  formatShortDayMonth,
  todayInSaoPaulo,
  weekStartMonday,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

interface OverviewPageProps {
  searchParams: Promise<{ view?: string; period?: string }>;
}

// Overview absorbs the former /semana and /mes as a Week | Month toggle held in
// the URL (?view=&period=), deep-linkable and server-rendered — the tabs and
// period nav are plain <Link>s, so switching is a client transition, never a
// full reload.
export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const lang = await getLang();
  const copy = COPY[lang];
  const today = todayInSaoPaulo();
  const { view: rawView, period } = await searchParams;
  const view = rawView === "month" ? "month" : "week";

  const tabClass = (active: boolean) =>
    `min-h-[44px] inline-flex items-center px-5 rounded-full border-2 border-forest font-semibold text-sm transition-[transform,box-shadow] duration-150 ${
      active
        ? "bg-clover text-white shadow-hard"
        : "bg-white text-forest hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard"
    }`;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <p className="eyebrow">{copy.overview.eyebrow}</p>
      <h1 className="display-title text-4xl sm:text-5xl mt-2 mb-5">
        {copy.overview.title}
      </h1>

      <div role="tablist" aria-label={copy.overview.title} className="flex gap-2 mb-6">
        <Link
          href="/overview?view=week"
          role="tab"
          aria-selected={view === "week"}
          className={tabClass(view === "week")}
        >
          {copy.overview.weekTab}
        </Link>
        <Link
          href="/overview?view=month"
          role="tab"
          aria-selected={view === "month"}
          className={tabClass(view === "month")}
        >
          {copy.overview.monthTab}
        </Link>
      </div>

      {view === "week" ? (
        <WeekView lang={lang} copy={copy} today={today} period={period} />
      ) : (
        <MonthView lang={lang} copy={copy} today={today} period={period} />
      )}
    </main>
  );
}

async function WeekView({
  lang,
  copy,
  today,
  period,
}: {
  lang: Awaited<ReturnType<typeof getLang>>;
  copy: (typeof COPY)[keyof typeof COPY];
  today: string;
  period?: string;
}) {
  const currentStart = weekStartMonday(today);
  const start =
    period && /^\d{4}-\d{2}-\d{2}$/.test(period) && !Number.isNaN(Date.parse(period))
      ? weekStartMonday(period)
      : currentStart;
  const week = await getWeekData(start);
  const label = `${formatShortDayMonth(start, lang)} – ${formatShortDayMonth(addDays(start, 6), lang)}`;

  return (
    <div className="flex flex-col gap-5">
      <PeriodNav
        label={label}
        prevHref={`/overview?view=week&period=${addDays(start, -7)}`}
        nextHref={`/overview?view=week&period=${addDays(start, 7)}`}
        prevAriaLabel={copy.week.prevAria}
        nextAriaLabel={copy.week.nextAria}
        todayLabel={copy.week.current}
        todayHref={start !== currentStart ? "/overview?view=week" : undefined}
      />
      {week.habits.every((h) => h.done.every((d) => !d)) && (
        <p className="text-sm opacity-75">
          {copy.week.emptyPre}{" "}
          <Link href="/" className="font-semibold underline">
            {copy.week.emptyLink}
          </Link>{" "}
          {copy.week.emptyPost}
        </p>
      )}
      <WeekGrid week={week} today={today} lang={lang} copy={copy.week} />
    </div>
  );
}

async function MonthView({
  lang,
  copy,
  today,
  period,
}: {
  lang: Awaited<ReturnType<typeof getLang>>;
  copy: (typeof COPY)[keyof typeof COPY];
  today: string;
  period?: string;
}) {
  const currentMonth = today.slice(0, 7);
  const month =
    period && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? period : currentMonth;
  const [data, stats, langs] = await Promise.all([
    getMonthData(month, today),
    getMonthDetailStats(month),
    listLanguages(false),
  ]);
  const languageNames = Object.fromEntries(langs.map((l) => [l.slug, l.name]));

  return (
    <div className="flex flex-col gap-6">
      <PeriodNav
        label={formatMonthLabel(month, lang)}
        prevHref={`/overview?view=month&period=${addMonths(month, -1)}`}
        nextHref={`/overview?view=month&period=${addMonths(month, 1)}`}
        prevAriaLabel={copy.month.prevAria}
        nextAriaLabel={copy.month.nextAria}
        todayLabel={copy.month.current}
        todayHref={month !== currentMonth ? "/overview?view=month" : undefined}
      />
      {data.habits.every((h) => h.doneCount === 0) && (
        <p className="text-sm opacity-75">
          {copy.month.emptyPre}{" "}
          <Link href="/" className="font-semibold underline">
            {copy.month.emptyLink}
          </Link>{" "}
          {copy.month.emptyPost}
        </p>
      )}
      <MonthSummary
        stats={stats}
        copy={copy.overview.summary}
        languageNames={languageNames}
      />
      <MonthProgress habits={data.habits} lang={lang} copy={copy.month} />
    </div>
  );
}
