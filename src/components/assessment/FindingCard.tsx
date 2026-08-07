import type { Finding } from "@/lib/diagnose";
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

  return (
    <article className="border-2 border-forest rounded-card bg-white shadow-hard p-4">
      <p className="eyebrow mb-1.5">{domain.name}</p>
      <h3 className="font-semibold">{pattern.name}</h3>
      <p className="mt-1.5 text-sm opacity-80">{pattern.means}</p>
      {/* What to do sits in straw: it is guidance to act on, not a settled
          state, and mint would read as "handled". */}
      <p className="mt-2.5 text-sm bg-straw/15 border-l-2 border-straw pl-3 py-1.5">
        {pattern.next}
      </p>
    </article>
  );
}

// The same finding as one line, for the ones below the fold. Everything the
// engine found is shown: AUTOPILOT and EMPTY_ACTION fire in *small*-distance
// domains by construction, so a screen that only listed the top five would
// structurally hide them, and "you are pouring effort into something that is
// not yours" is among the most useful things this can say.
export function FindingLine({ finding, copy }: FindingCardProps) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t-2 border-dashed border-sand pt-2.5">
      <span className="font-semibold text-sm">
        {copy.domains[finding.domainSlug].name}
      </span>
      <span className="text-sm opacity-75">
        {copy.patterns[finding.pattern].name}
      </span>
    </li>
  );
}
