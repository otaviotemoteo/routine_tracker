import { NavBar } from "@/components/NavBar";
import { TodayChecklist } from "@/components/TodayChecklist";
import { getDayChecks } from "@/db/queries";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { formatDayLong, todayInSaoPaulo } from "@/lib/utils";

// Always render with the current São Paulo day — never cache a stale "today".
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const lang = await getLang();
  const copy = COPY[lang];
  const today = todayInSaoPaulo();
  const checks = await getDayChecks(today);

  return (
    <>
      <NavBar lang={lang} copy={copy.nav} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <p className="eyebrow">{formatDayLong(today, lang)}</p>
        <TodayChecklist
          initialChecks={checks}
          title={copy.today.title}
          lang={lang}
          copy={copy.today}
        />
      </main>
    </>
  );
}
