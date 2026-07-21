import { NavBar } from "@/components/NavBar";
import { PeriodNav } from "@/components/PeriodNav";
import { WeekGrid } from "@/components/WeekGrid";
import { getWeekData } from "@/db/queries";
import {
  addDays,
  formatShortDayMonthPtBR,
  todayInSaoPaulo,
  weekStartMonday,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

interface SemanaPageProps {
  searchParams: Promise<{ start?: string }>;
}

export default async function SemanaPage({ searchParams }: SemanaPageProps) {
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

  const label = `${formatShortDayMonthPtBR(start)} – ${formatShortDayMonthPtBR(addDays(start, 6))}`;

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <p className="eyebrow">Consistência dia a dia</p>
        <h1 className="display-title text-4xl sm:text-5xl mt-2 mb-6">Semana</h1>
        <div className="flex flex-col gap-5">
          <PeriodNav
            label={label}
            prevHref={`/semana?start=${addDays(start, -7)}`}
            nextHref={`/semana?start=${addDays(start, 7)}`}
            prevAriaLabel="Semana anterior"
            nextAriaLabel="Próxima semana"
            todayHref={start !== currentStart ? "/semana" : undefined}
          />
          <WeekGrid week={week} today={today} />
        </div>
      </main>
    </>
  );
}
