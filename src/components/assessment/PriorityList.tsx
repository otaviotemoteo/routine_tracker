import { PRIORITY_CUT, type DomainGap } from "@/lib/diagnose";
import type { DomainSlug } from "@/lib/domains";
import { format, type Copy } from "@/lib/i18n";

interface PriorityListProps {
  // Read from the sealed assessment, never recomputed. Freezing the cut is
  // what stops a later change to the thresholds from quietly rewriting which
  // domains a past cycle prioritised.
  priority: DomainSlug[];
  rows: DomainGap[];
  // Standard deviation of the distances. Small means the domains are bunched
  // and the cut at five is somewhat arbitrary, which is worth admitting.
  spread: number | null;
  narrowSpread: boolean;
  copy: Copy["assessment"];
}

export function PriorityList({
  priority,
  rows,
  narrowSpread,
  copy,
}: PriorityListProps) {
  const gapFor = (slug: DomainSlug) =>
    rows.find((row) => row.domainSlug === slug)?.gap ?? 0;

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

      <ol className="flex flex-col gap-2.5 mt-4 list-none">
        {priority.map((slug, i) => (
          <li
            key={slug}
            className="flex items-center gap-3 border-2 border-forest rounded-card bg-mint px-4 py-3"
          >
            <span className="font-mono font-bold text-lg opacity-40 tabular-nums">
              {i + 1}
            </span>
            <span className="flex-1 font-semibold">
              {copy.domains[slug].name}
            </span>
            <span className="font-mono text-xs opacity-70 shrink-0">
              {format(copy.results.gapLabel, { n: gapFor(slug) })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
