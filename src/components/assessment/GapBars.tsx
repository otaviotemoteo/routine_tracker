import { domainIcon } from "@/lib/domain-icons";
import type { DomainGap } from "@/lib/diagnose";
import { cardSurface } from "@/components/ui/styles";
import { format, type Copy } from "@/lib/i18n";
import { ScoreBar } from "./ScoreBar";

interface GapBarsProps {
  rows: DomainGap[];
  copy: Copy["assessment"];
}

// Importance against action, one block per domain, widest distance first.
//
// The first version drew a single track carrying three variables at once and
// it did not read: a grey fill for action, a tick for importance, and a
// straw/sand ramp for the distance between them. "Family, 6 apart" is not a
// sentence anyone can act on.
//
// This draws the two answers plainly and lets the distance be the thing you
// see rather than a number you have to decode. The figure stays on the right
// because it is the sort key, but it is now explained by the two bars under it
// instead of asserted on its own.
export function GapBars({ rows, copy }: GapBarsProps) {
  return (
    <figure className={`${cardSurface} mt-4 p-4 sm:p-5`}>
      <figcaption className="sr-only">{copy.results.chartTitle}</figcaption>

      <ul className="flex flex-col list-none">
        {rows.map((row, i) => {
          const domain = copy.domains[row.domainSlug];
          const Icon = domainIcon(row.domainSlug);
          const gapText =
            row.gap === 0
              ? copy.results.gapNone
              : row.gap < 0
                ? format(copy.results.gapInverted, { n: Math.abs(row.gap) })
                : format(copy.results.gapLabel, { n: row.gap });

          return (
            <li
              key={row.domainSlug}
              className={
                i === 0 ? "" : "border-t-2 border-dashed border-sand mt-3 pt-3"
              }
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 shrink-0 opacity-60" aria-hidden />
                  <span className="font-semibold text-sm truncate">
                    {domain.name}
                  </span>
                </span>
                <span className="font-mono text-xs opacity-70 shrink-0">
                  {gapText}
                </span>
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
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
                  valueLabel={format(copy.results.scoreOutOf, { n: row.action })}
                />
              </div>

              {/* The bars are aria-hidden, so the row still has to say its
                  figures once in reading order. */}
              <p className="sr-only">
                {domain.name}. {copy.results.importanceLabel}:{" "}
                {row.importanceGeneral}. {copy.results.actionLabel}: {row.action}.{" "}
                {gapText}.
              </p>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
