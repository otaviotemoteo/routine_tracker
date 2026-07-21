import { NavBar } from "@/components/NavBar";
import { TodayChecklist } from "@/components/TodayChecklist";
import { getDayChecks } from "@/db/queries";
import { formatDayLongPtBR, todayInSaoPaulo } from "@/lib/utils";

// Always render with the current São Paulo day — never cache a stale "today".
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const today = todayInSaoPaulo();
  const checks = await getDayChecks(today);

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <p className="eyebrow">{formatDayLongPtBR(today)}</p>
        <h1 className="display-title text-4xl sm:text-5xl mt-2 mb-7">Hoje</h1>
        <TodayChecklist initialChecks={checks} />
      </main>
    </>
  );
}
