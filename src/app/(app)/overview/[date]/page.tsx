import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { getAuditLookups, getDayChecksReadonly } from "@/db/queries";
import { getLang } from "@/lib/get-lang";
import { COPY, habitName } from "@/lib/i18n";
import { habitIcon } from "@/lib/icons";
import { describeDetails } from "@/lib/describe-details";
import { formatDayLong } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface DayAuditPageProps {
  params: Promise<{ date: string }>;
}

// The "what exactly did I do that day" screen — the visual twin of one `day`
// object from /api/export.
export default async function DayAuditPage({ params }: DayAuditPageProps) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    notFound();
  }

  const lang = await getLang();
  const copy = COPY[lang];
  const [checks, lookups] = await Promise.all([
    getDayChecksReadonly(date),
    getAuditLookups(),
  ]);
  const anyLogged = checks.some((c) => c.done || c.details || c.note);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <p className="eyebrow">{copy.dayAudit.eyebrow}</p>
      <h1 className="display-title text-3xl sm:text-4xl mt-2 mb-5 first-letter:uppercase">
        {formatDayLong(date, lang)}
      </h1>
      <Link
        href="/overview?view=week"
        className="inline-flex items-center gap-1.5 font-semibold text-sm underline min-h-[44px] mb-4"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        {copy.dayAudit.back}
      </Link>

      {!anyLogged ? (
        <p className="opacity-75 mt-4">{copy.dayAudit.noneLogged}</p>
      ) : (
        <ul className="flex flex-col gap-3 list-none">
          {checks.map((check) => {
            const Icon = habitIcon(check.slug);
            const name = habitName(lang, check.slug, check.name);
            const lines = describeDetails(
              check.slug,
              check.details,
              lookups,
              copy.sheets
            );
            return (
              <li
                key={check.id}
                className={`bg-white border-2 border-forest rounded-card shadow-hard px-5 py-4 ${
                  check.optional ? "border-dashed" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <Icon aria-hidden className="w-5 h-5 text-clover shrink-0" />
                    {name}
                  </span>
                  {check.done ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-clover">
                      <Check className="w-4 h-4" strokeWidth={3} aria-hidden />
                      {copy.week.done}
                    </span>
                  ) : (
                    <span className="text-sm opacity-50">
                      {copy.dayAudit.notLogged}
                    </span>
                  )}
                </div>
                {lines.length > 0 && (
                  <dl className="mt-2.5 flex flex-col gap-1 text-sm">
                    {lines.map((line, i) => (
                      <div key={i} className="flex gap-2">
                        <dt className="font-semibold opacity-70 shrink-0">
                          {line.label}
                        </dt>
                        <dd className="font-mono">{line.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {check.note && (
                  <p className="mt-2 text-sm italic opacity-75 border-l-2 border-sand pl-3">
                    {check.note}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
