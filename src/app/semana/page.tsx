import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { PeriodNav } from "@/components/PeriodNav";
import { WeekGrid } from "@/components/WeekGrid";
import { getWeekData } from "@/db/queries";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import {
  addDays,
  formatShortDayMonth,
  todayInSaoPaulo,
  weekStartMonday,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

interface SemanaPageProps {
  searchParams: Promise<{ start?: string }>;
}

export default async function SemanaPage({ searchParams }: SemanaPageProps) {
  const lang = await getLang();
  const copy = COPY[lang];
  const today = todayInSaoPaulo();
  const currentStart = weekStartMonday(today);

  // Any date is accepted and normalized to its Monday; garbage falls back to
  // the current week instead of erroring.
  const { start: raw } = await searchParams;
  const start =
    raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw))
      ? weekStartMonday(raw)
      : currentStart;
  const week = await getWeekData(start);

  const label = `${formatShortDayMonth(start, lang)} – ${formatShortDayMonth(addDays(start, 6), lang)}`;

  return (
    <>
      <NavBar lang={lang} copy={copy.nav} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <p className="eyebrow">{copy.week.eyebrow}</p>
        <h1 className="display-title text-4xl sm:text-5xl mt-2 mb-6">
          {copy.week.title}
        </h1>
        <div className="flex flex-col gap-5">
          <PeriodNav
            label={label}
            prevHref={`/semana?start=${addDays(start, -7)}`}
            nextHref={`/semana?start=${addDays(start, 7)}`}
            prevAriaLabel={copy.week.prevAria}
            nextAriaLabel={copy.week.nextAria}
            todayLabel={copy.week.current}
            todayHref={start !== currentStart ? "/semana" : undefined}
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
      </main>
    </>
  );
}
