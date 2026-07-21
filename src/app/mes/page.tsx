import { NavBar } from "@/components/NavBar";
import { PeriodNav } from "@/components/PeriodNav";
import { MonthProgress } from "@/components/MonthProgress";
import { getMonthData } from "@/db/queries";
import { addMonths, formatMonthPtBR, todayInSaoPaulo } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface MesPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function MesPage({ searchParams }: MesPageProps) {
  const today = todayInSaoPaulo();
  const currentMonth = today.slice(0, 7);

  const { month: raw } = await searchParams;
  const month =
    raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : currentMonth;
  const data = await getMonthData(month, today);

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <p className="eyebrow">Adesão e sequência</p>
        <h1 className="display-title text-4xl sm:text-5xl mt-2 mb-6">Mês</h1>
        <div className="flex flex-col gap-5">
          <PeriodNav
            label={formatMonthPtBR(month)}
            prevHref={`/mes?month=${addMonths(month, -1)}`}
            nextHref={`/mes?month=${addMonths(month, 1)}`}
            prevAriaLabel="Mês anterior"
            nextAriaLabel="Próximo mês"
            todayHref={month !== currentMonth ? "/mes" : undefined}
          />
          <MonthProgress habits={data.habits} />
        </div>
      </main>
    </>
  );
}
