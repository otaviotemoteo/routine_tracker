import { domainIcon } from "@/lib/domain-icons";
import type { Finding } from "@/lib/diagnose";
import { cardSurface } from "@/components/ui/styles";
import type { Copy } from "@/lib/i18n";

interface FindingCardProps {
  finding: Finding;
  copy: Copy["assessment"];
}

// One pattern the engine found, in full: what it is, what it means, and what
// to do about it.
//
// The copy never says "you failed" and never reads a mood off a number. The
// grid is self-report, and a screen whose job is to show you a distance turns
// into a machine for feeling bad the moment it starts grading.
export function FindingCard({ finding, copy }: FindingCardProps) {
  const pattern = copy.patterns[finding.pattern];
  const domain = copy.domains[finding.domainSlug];
  const Icon = domainIcon(finding.domainSlug);

  return (
    <article className={`${cardSurface} p-4`}>
      <p className="eyebrow mb-1.5">{domain.name}</p>
      <h3 className="flex items-start gap-2 font-semibold">
        <Icon className="w-4 h-4 mt-0.5 shrink-0 opacity-60" aria-hidden />
        {pattern.name}
      </h3>
      <p className="mt-1.5 text-sm opacity-80">{pattern.means}</p>
      {/* What to do sits in straw: it is guidance to act on, not a settled
          state, and mint would read as "handled". */}
      <p className="mt-2.5 text-sm bg-straw/15 border-l-2 border-straw pl-3 py-1.5">
        {pattern.next}
      </p>
    </article>
  );
}

interface FindingTableProps {
  findings: Finding[];
  copy: Copy["assessment"];
}

// Everything else the engine found, as a table.
//
// These were a run of standalone sentences and they read as vague. The same
// facts have the same shape every time — an area, a claim about importance, a
// claim about action — so they are columns, and the repetition becomes the
// thing that makes them scannable instead of the thing that makes them mush.
//
// Every finding is shown, not just the priority ones: AUTOPILOT and
// EMPTY_ACTION fire in *small*-distance domains by construction, so a listing
// that only covered the top five would structurally hide them.
export function FindingTable({ findings, copy }: FindingTableProps) {
  return (
    <div className={`${cardSurface} mt-3 overflow-hidden`}>
      {/* Column headers only where there are columns. Below sm each finding
          stacks into its own labelled block, because a three-column table at
          360px is not a table, it is a wrap. */}
      <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr] gap-x-4 px-4 py-2.5 border-b-2 border-forest bg-mint text-xs font-semibold uppercase tracking-wide">
        <span>{copy.results.colArea}</span>
        <span>{copy.results.colImportance}</span>
        <span>{copy.results.colAction}</span>
      </div>

      <ul className="list-none">
        {findings.map((finding, i) => {
          const pattern = copy.patterns[finding.pattern];
          const domain = copy.domains[finding.domainSlug];
          const Icon = domainIcon(finding.domainSlug);

          return (
            <li
              key={`${finding.domainSlug}-${finding.pattern}`}
              className={i === 0 ? "" : "border-t-2 border-dashed border-sand"}
            >
              <div className="sm:grid sm:grid-cols-[1fr_1fr_1fr] sm:gap-x-4 sm:items-stretch">
                <div className="flex items-center gap-2 px-4 pt-3 sm:py-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0 opacity-60" aria-hidden />
                  <span className="font-semibold text-sm truncate">
                    {domain.name}
                  </span>
                </div>

                <div className="px-4 pt-2 sm:py-3 text-sm">
                  <span className="sm:hidden text-xs opacity-60 block">
                    {copy.results.colImportance}
                  </span>
                  {pattern.importance}
                </div>

                {/* Straw says "not currently active" alongside the words, never
                    instead of them. A pattern that makes only one claim spans
                    rather than inventing a second. */}
                {pattern.action ? (
                  <div className="px-4 pt-2 pb-3 sm:py-3 text-sm bg-straw/15">
                    <span className="sm:hidden text-xs opacity-60 block">
                      {copy.results.colAction}
                    </span>
                    {pattern.action}
                  </div>
                ) : (
                  <div className="hidden sm:block" aria-hidden />
                )}
                {!pattern.action && <div className="pb-3 sm:hidden" />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
