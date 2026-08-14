import Link from "next/link";
import { Pencil } from "lucide-react";
import { PaceInfo } from "@/components/PaceInfo";
import { ghostButton } from "@/components/ui/styles";
import type { Copy } from "@/lib/i18n";
import type { SetupRow } from "@/lib/setup-summary";

interface ActivitiesSectionProps {
  rows: SetupRow[];
  copy: Copy["today"];
  readingCopy: Copy["onboarding"]["reading"];
}

// The configured setup, one row per area, each linking to its section in
// /config (which reuses the onboarding forms).
//
// Every row is the same three-line stack — LABEL, the value, the note — so the
// eye lands in the same place whichever area it is reading. That regularity is
// the whole point: this is a list you scan for the one thing you came to
// change, and seven rows of differing shapes made it a list you read.
//
// The row used to be one big overlay link with the edit affordance painted on
// top, which meant the pace ⓘ had to be stacked above it to avoid nesting a
// button inside a link. An explicit 44px edit target removes that fight
// entirely: two plain siblings, no overlay, no pointer-events juggling.
export function ActivitiesSection({
  rows,
  copy,
  readingCopy,
}: ActivitiesSectionProps) {
  return (
    <section aria-label={copy.activities} className="mt-10">
      <h2 className="display-title text-2xl">{copy.activities}</h2>
      <p className="text-sm opacity-75 mt-1 mb-4">{copy.activitiesLead}</p>

      <ul className="flex flex-col gap-2.5 list-none">
        {rows.map((row) => {
          const showPace = row.section === "reading" && row.hintTone === "info";
          return (
            <li
              key={row.section}
              className={`min-h-[74px] flex items-center gap-3 flex-wrap px-3 py-2.5 rounded-card border-2 border-forest shadow-hard ${
                row.configured ? "bg-mint" : "bg-white"
              }`}
            >
              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                <span className="flex items-center gap-2 font-mono text-[9.5px] font-bold tracking-widest">
                  <span className="opacity-60">{row.label.toUpperCase()}</span>
                  {/* A mint card already reads as "done", so only the
                      unfinished case is spelled out. */}
                  {!row.configured && (
                    <span className="text-straw tracking-normal font-sans text-xs font-semibold">
                      · {copy.notConfiguredBadge}
                    </span>
                  )}
                </span>

                <span
                  className={`font-semibold truncate ${
                    row.value ? "" : "opacity-50"
                  }`}
                >
                  {row.value ?? copy.notSet}
                </span>

                {/* The note sits on its own line rather than trailing the
                    value: two of them are long enough to push the value out of
                    sight when they share a row at 360px. */}
                {row.hint && (
                  <span
                    className={`text-xs truncate ${
                      row.hintTone === "warn" ? "text-straw" : "text-clover"
                    }`}
                  >
                    {row.hint}
                  </span>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-1.5 ml-auto">
                {showPace && (
                  <PaceInfo copy={readingCopy} values={row.paceValues} />
                )}
                <Link
                  href={`/config?section=${row.section}&from=overview`}
                  aria-label={`${copy.edit} — ${row.label}`}
                  className={`${ghostButton} !min-w-[44px] !px-0 w-11 justify-center`}
                >
                  <Pencil className="w-4 h-4" aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
