import Link from "next/link";
import { Pencil } from "lucide-react";
import { PaceInfo } from "@/components/PaceInfo";
import type { Copy } from "@/lib/i18n";
import type { SetupRow } from "@/lib/setup-summary";

interface ActivitiesSectionProps {
  rows: SetupRow[];
  copy: Copy["today"];
  readingCopy: Copy["onboarding"]["reading"];
}

// The configured setup, editable in place — each row links to its section in
// /config (which reuses the onboarding forms). A mint card already says
// "configured", so only the unfinished case is called out.
export function ActivitiesSection({
  rows,
  copy,
  readingCopy,
}: ActivitiesSectionProps) {
  return (
    <section aria-label={copy.activities} className="mt-10">
      <h2 className="display-title text-2xl">{copy.activities}</h2>
      <p className="text-sm opacity-75 mt-1 mb-4">{copy.activitiesLead}</p>
      <ul className="flex flex-col gap-3 list-none">
        {rows.map((row) => {
          const showPace = row.section === "reading" && row.hintTone === "info";
          return (
            <li
              key={row.section}
              // The card's link is an overlay so the ⓘ can sit above it —
              // stacked, never nested (no <button> inside <a>).
              className={`relative min-h-[64px] flex items-center justify-between gap-3 px-5 py-3 rounded-card border-2 border-forest shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg ${
                row.configured ? "bg-mint" : "bg-white"
              }`}
            >
              <Link
                href={`/config?section=${row.section}&from=overview`}
                aria-label={`${copy.edit} — ${row.label}`}
                className="absolute inset-0 rounded-card"
              />

              <span className="relative min-w-0 flex-1 pointer-events-none">
                <span className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold">
                  <span className="opacity-60">{row.label}</span>
                  {!row.configured && (
                    <span className="normal-case tracking-normal text-straw">
                      · {copy.notConfiguredBadge}
                    </span>
                  )}
                </span>
                {/* Value and its note read as one line, the note trailing it. */}
                <span className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className={`font-semibold ${row.value ? "" : "opacity-50"}`}
                  >
                    {row.value ?? copy.notSet}
                  </span>
                  {row.hint && (
                    <span
                      className={`text-xs ${
                        row.hintTone === "warn" ? "text-straw" : "text-clover"
                      }`}
                    >
                      {row.hint}
                    </span>
                  )}
                </span>
              </span>

              <span className="relative flex items-center gap-3 shrink-0">
                {showPace && (
                  <PaceInfo copy={readingCopy} values={row.paceValues} />
                )}
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold pointer-events-none">
                  <Pencil className="w-4 h-4" aria-hidden />
                  {copy.edit}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
