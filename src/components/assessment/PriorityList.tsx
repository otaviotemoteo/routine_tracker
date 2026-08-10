import { PRIORITY_CUT, type DomainGap, type Finding } from "@/lib/diagnose";
import { domainIcon } from "@/lib/domain-icons";
import type { DomainSlug } from "@/lib/domains";
import { format, type Copy } from "@/lib/i18n";
import { ScoreBar } from "./ScoreBar";

interface PriorityListProps {
  // Read from the sealed assessment, never recomputed. Freezing the cut is
  // what stops a later change to the thresholds from quietly rewriting which
  // domains a past cycle prioritised.
  priority: DomainSlug[];
  rows: DomainGap[];
  findings: Finding[];
  // Standard deviation of the distances. Small means the domains are bunched
  // and the cut at five is somewhat arbitrary, which is worth admitting.
  narrowSpread: boolean;
  copy: Copy["assessment"];
}

export function PriorityList({
  priority,
  rows,
  findings,
  narrowSpread,
  copy,
}: PriorityListProps) {
  return (
    <section className="mt-10">
      <h2 className="display-title text-2xl">{copy.results.priorityTitle}</h2>
      <p className="mt-2 text-sm opacity-75">{copy.results.priorityLead}</p>

      {/* Honesty about the ranking's own resolution. Over twelve domains a
          small spread means the order is real but the line drawn at five is
          not much more than a line. */}
      {narrowSpread && (
        <p className="mt-3 text-sm bg-straw/15 border-2 border-forest rounded-card px-4 py-2.5">
          {copy.results.narrowSpread}
        </p>
      )}

      {priority.length < PRIORITY_CUT && (
        <p className="mt-3 text-sm bg-straw/15 border-2 border-forest rounded-card px-4 py-2.5">
          {copy.results.fewerThanFive}
        </p>
      )}

      <ol className="flex flex-col gap-3 mt-4 list-none">
        {priority.map((slug, i) => {
          const row = rows.find((r) => r.domainSlug === slug);
          const Icon = domainIcon(slug);
          // Why this area is on the list, in the engine's own words. Often
          // empty — a wide distance does not have to cross a threshold — and
          // the card is expected to stand without it.
          const own = findings.filter((f) => f.domainSlug === slug);

          return (
            <li
              key={slug}
              className="border-2 border-forest rounded-card bg-mint px-4 py-3.5"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono font-bold text-lg opacity-40 tabular-nums">
                  {i + 1}
                </span>
                <span className="flex items-center gap-2 flex-1 min-w-0">
                  <Icon className="w-4 h-4 shrink-0 opacity-60" aria-hidden />
                  <span className="font-semibold truncate">
                    {copy.domains[slug].name}
                  </span>
                </span>
                <span className="font-mono text-xs opacity-70 shrink-0">
                  {format(copy.results.gapLabel, { n: row?.gap ?? 0 })}
                </span>
              </div>

              {row && (
                <div className="flex flex-col gap-1.5 mt-2.5">
                  <ScoreBar
                    label={copy.results.importanceLabel}
                    value={row.importanceGeneral}
                    valueLabel={format(copy.results.scoreOutOf, {
                      n: row.importanceGeneral,
                    })}
                  />
                  <ScoreBar
                    label={copy.results.actionLabel}
                    value={row.action}
                    valueLabel={format(copy.results.scoreOutOf, {
                      n: row.action,
                    })}
                  />
                </div>
              )}

              {own.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 mt-3 list-none">
                  {own.map((finding) => (
                    <li
                      key={finding.pattern}
                      className="text-xs border-2 border-forest rounded-full bg-white px-2.5 py-0.5"
                    >
                      {copy.patterns[finding.pattern].importance}
                      {copy.patterns[finding.pattern].action
                        ? ` · ${copy.patterns[finding.pattern].action}`
                        : ""}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
