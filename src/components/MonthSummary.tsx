import type { Copy } from "@/lib/i18n";
import type { MonthDetailStats } from "@/db/queries";

interface MonthSummaryProps {
  stats: MonthDetailStats;
  copy: Copy["overview"]["summary"];
  languageNames: Record<string, string>;
}

// Rich per-area stats for the month view, shown only where data exists.
export function MonthSummary({ stats, copy, languageNames }: MonthSummaryProps) {
  const cards: { label: string; value: string; sub?: string }[] = [];

  if (stats.sleep.avgHours !== null) {
    cards.push({ label: copy.avgSleep, value: `${stats.sleep.avgHours} h` });
  }
  if (stats.reading.totalPages > 0) {
    cards.push({ label: copy.totalPages, value: `${stats.reading.totalPages}` });
  }
  if (stats.workout.days > 0) {
    cards.push({ label: copy.workout, value: `${stats.workout.percent}%` });
  }
  if (stats.duolingo.total > 0) {
    const sub =
      stats.duolingo.perLanguage.length > 1
        ? stats.duolingo.perLanguage
            .map((l) => `${languageNames[l.slug] ?? l.slug} ${l.lessons}`)
            .join(" · ")
        : undefined;
    cards.push({ label: copy.lessons, value: `${stats.duolingo.total}`, sub });
  }
  if (stats.spirituality.totalCheckins > 0) {
    cards.push({
      label: copy.practices,
      value: `${stats.spirituality.totalCheckins}`,
    });
  }

  if (cards.length === 0) return null;

  return (
    <section aria-label={copy.title}>
      <h2 className="text-xs uppercase tracking-widest font-semibold opacity-60 mb-3">
        {copy.title}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-white border-2 border-forest rounded-card shadow-hard px-4 py-3"
          >
            <p className="font-mono font-bold text-2xl">{c.value}</p>
            <p className="text-sm font-semibold opacity-75">{c.label}</p>
            {c.sub && <p className="text-xs opacity-60 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
