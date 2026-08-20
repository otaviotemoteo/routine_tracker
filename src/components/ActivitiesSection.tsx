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
// Two things carry this layout:
//
// GROUPING. The whole list lives inside one bordered panel, title included,
// rather than as loose rows on the page. Six free-floating cards under a
// heading read as six unrelated things; inside a panel they read as one
// thing with six parts, which is what they are — this is the setup, and you
// come here to change one piece of it.
//
// THE THREE-LINE STACK. Every row is LABEL / value / meta, in that order and
// always all three. The regularity is the point: the eye lands in the same
// place whichever area it is reading. It matters most when a row has little
// to say — a two-line row beside five three-line ones looks broken rather
// than empty, which is why setup-summary.ts gives every section a meta.
export function ActivitiesSection({
  rows,
  copy,
  readingCopy,
}: ActivitiesSectionProps) {
  return (
    <section
      aria-label={copy.activities}
      className="mt-10 border-2 border-forest rounded-card p-4 sm:p-5"
    >
      <h2 className="display-title text-2xl">{copy.activities}</h2>
      <p className="text-sm opacity-75 mt-1 mb-4">{copy.activitiesLead}</p>

      <ul className="flex flex-col gap-2.5 list-none">
        {rows.map((row) => {
          const showPace = row.templateKind === "leitura" && row.hintTone === "info";
          return (
            <li
              key={row.activityId}
              className={`min-h-[74px] flex items-center gap-3 flex-wrap px-4 py-3 rounded-card border-2 border-forest shadow-hard ${
                row.configured ? "bg-white" : "bg-cream"
              }`}
            >
              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                <span className="flex items-center gap-2 flex-wrap font-mono text-[9.5px] font-bold tracking-widest">
                  <span className="opacity-55">{row.label.toUpperCase()}</span>
                  {/* Only the unfinished case is spelled out; a finished row
                      says what it is set up to do, which is louder. */}
                  {!row.configured && (
                    <span className="font-sans text-xs font-semibold tracking-normal text-straw">
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

                {/* The third line. The warn hint outranks the meta when there
                    is one — "you're 2 books short" is worth more than "4 books
                    on the list", and stacking both would make this row twice
                    the height of its neighbours. */}
                {(row.hint ?? row.meta) && (
                  <span
                    className={`text-xs truncate ${
                      row.hint
                        ? row.hintTone === "warn"
                          ? "text-straw"
                          : "text-clover"
                        : "opacity-60"
                    }`}
                  >
                    {row.hint ?? row.meta}
                  </span>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-2 ml-auto">
                {showPace && (
                  <PaceInfo copy={readingCopy} values={row.paceValues} />
                )}
                <Link
                  href={`/config?activity=${row.activityId}&from=overview`}
                  className={ghostButton}
                >
                  <Pencil className="w-4 h-4 mr-1.5" aria-hidden />
                  {copy.edit}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
