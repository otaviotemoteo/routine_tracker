"use client";

import { useState } from "react";
import { domainIcon } from "@/lib/domain-icons";
import type { DomainGap } from "@/lib/diagnose";
import { cardSurface, ghostButton } from "@/components/ui/styles";
import { format, type Copy } from "@/lib/i18n";
import { ScoreBar } from "./ScoreBar";

interface GapBarsProps {
  rows: DomainGap[];
  copy: Copy["assessment"];
}

// How many areas are worth reading before the card becomes a wall. Twelve
// two-bar rows is most of a phone screen scrolled twice, and the widest
// distances are the only ones anyone acts on.
const PREVIEW = 3;

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
  const [expanded, setExpanded] = useState(false);
  const collapsible = rows.length > PREVIEW;
  // One row past the cut when collapsed, so the fade has something to fade and
  // it is visibly a list that continues rather than a list that ended.
  const shown = expanded || !collapsible ? rows : rows.slice(0, PREVIEW + 1);

  return (
    <figure className={`${cardSurface} mt-4 p-4 sm:p-5`}>
      <figcaption className="sr-only">{copy.results.chartTitle}</figcaption>

      <div className="relative">
        <ul className="flex flex-col list-none">
          {shown.map((row, i) => {
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
                    valueLabel={format(copy.results.scoreOutOf, {
                      n: row.action,
                    })}
                  />
                </div>

                {/* The bars are aria-hidden, so the row still has to say its
                    figures once in reading order. */}
                <p className="sr-only">
                  {domain.name}. {copy.results.importanceLabel}:{" "}
                  {row.importanceGeneral}. {copy.results.actionLabel}:{" "}
                  {row.action}. {gapText}.
                </p>
              </li>
            );
          })}
        </ul>

        {/* The fade sits over the last rendered row so the card ends in a
            gradient rather than a hard cut, and the button lands on it. */}
        {collapsible && !expanded && (
          <div className="absolute inset-x-0 bottom-0 h-28 flex items-end justify-center bg-gradient-to-t from-white via-white to-transparent">
            <button
              type="button"
              aria-expanded={false}
              onClick={() => setExpanded(true)}
              className={ghostButton}
            >
              {format(copy.results.showAllAreas, { n: rows.length })}
            </button>
          </div>
        )}
      </div>

      {collapsible && expanded && (
        <div className="flex justify-center mt-4">
          <button
            type="button"
            aria-expanded
            onClick={() => setExpanded(false)}
            className={ghostButton}
          >
            {copy.results.showFewerAreas}
          </button>
        </div>
      )}
    </figure>
  );
}
