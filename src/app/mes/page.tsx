import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { PeriodNav } from "@/components/PeriodNav";
import { MonthProgress } from "@/components/MonthProgress";
import { getMonthData } from "@/db/queries";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { addMonths, formatMonthLabel, todayInSaoPaulo } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface MesPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function MesPage({ searchParams }: MesPageProps) {
  const lang = await getLang();
  const copy = COPY[lang];
  const today = todayInSaoPaulo();
  const currentMonth = today.slice(0, 7);

  const { month: raw } = await searchParams;
  const month =
    raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : currentMonth;
  const data = await getMonthData(month, today);

  return (
    <>
      <NavBar lang={lang} copy={copy.nav} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <p className="eyebrow">{copy.month.eyebrow}</p>
        <h1 className="display-title text-4xl sm:text-5xl mt-2 mb-6">
          {copy.month.title}
        </h1>
        <div className="flex flex-col gap-5">
          <PeriodNav
            label={formatMonthLabel(month, lang)}
            prevHref={`/mes?month=${addMonths(month, -1)}`}
            nextHref={`/mes?month=${addMonths(month, 1)}`}
            prevAriaLabel={copy.month.prevAria}
            nextAriaLabel={copy.month.nextAria}
            todayLabel={copy.month.current}
            todayHref={month !== currentMonth ? "/mes" : undefined}
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
          <MonthProgress habits={data.habits} lang={lang} copy={copy.month} />
        </div>
      </main>
    </>
  );
}
