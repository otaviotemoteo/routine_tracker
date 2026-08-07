import { SCALE_MAX } from "@/lib/domains";
import type { DomainGap } from "@/lib/diagnose";
import { format, type Copy } from "@/lib/i18n";

interface GapBarsProps {
  rows: DomainGap[];
  copy: Copy["assessment"];
}

// Where a distance stops being noise. Three steps, so the ramp is readable
// without a key you have to memorise.
const WIDE = 5;
const SOME = 3;

function band(gap: number): string {
  if (gap >= WIDE) return "bg-straw";
  if (gap >= SOME) return "bg-straw/45";
  return "bg-sand";
}

// Importance against action, one row per domain, widest distance first.
//
// The colour encodes the DISTANCE, never the score. A 3 in community life can
// be a perfectly healthy answer, and colouring absolute values green and red
// would teach you to produce the right number instead of the true one. Nothing
// here is clover either: in this palette clover means done and positive, and
// no rating on this screen is either.
export function GapBars({ rows, copy }: GapBarsProps) {
  const pct = (n: number) => (n / SCALE_MAX) * 100;

  return (
    <figure className="mt-4">
      <figcaption className="sr-only">{copy.results.chartTitle}</figcaption>

      <ul className="flex flex-col gap-3 list-none">
        {rows.map((row) => {
          const domain = copy.domains[row.domainSlug];
          const inverted = row.gap < 0;
          const lo = Math.min(row.action, row.importanceGeneral);
          const width = Math.abs(row.importanceGeneral - row.action);
          const gapText =
            row.gap === 0
              ? copy.results.gapNone
              : inverted
                ? format(copy.results.gapInverted, { n: Math.abs(row.gap) })
                : format(copy.results.gapLabel, { n: row.gap });

          return (
            <li key={row.domainSlug}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-sm">{domain.name}</span>
                {/* The figure and its name in words, because a bare number
                    needs decoding and a bare colour cannot be read at all. */}
                <span className="font-mono text-xs opacity-70 shrink-0">
                  {gapText}
                </span>
              </div>

              <div className="relative mt-1.5 h-4 rounded-full border-2 border-forest bg-cream overflow-hidden">
                {/* The distance itself, as a band between the two answers. */}
                <div
                  className={`absolute inset-y-0 ${
                    inverted ? "bg-sand" : band(row.gap)
                  }`}
                  style={{ left: `${pct(lo)}%`, width: `${pct(width)}%` }}
                />
                {/* What you did. */}
                <div
                  className="absolute inset-y-0 left-0 bg-forest/20"
                  style={{ width: `${pct(row.action)}%` }}
                />
                {/* What you said it matters. */}
                <div
                  className="absolute inset-y-0 w-0.5 bg-forest"
                  style={{ left: `calc(${pct(row.importanceGeneral)}% - 1px)` }}
                />
              </div>

              <p className="sr-only">
                {copy.results.importanceLabel}: {row.importanceGeneral}.{" "}
                {copy.results.actionLabel}: {row.action}. {gapText}.
              </p>
            </li>
          );
        })}
      </ul>

      {/* A ramp nobody can read is decoration. */}
      <div
        aria-hidden
        className="flex items-center gap-2 mt-4 text-xs opacity-70"
      >
        <span>{copy.results.legendLess}</span>
        <span className="h-3 w-6 rounded-sm border-2 border-forest bg-sand" />
        <span className="h-3 w-6 rounded-sm border-2 border-forest bg-straw/45" />
        <span className="h-3 w-6 rounded-sm border-2 border-forest bg-straw" />
        <span>{copy.results.legendMore}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-forest" />
          {copy.results.importanceLabel}
        </span>
      </div>
    </figure>
  );
}
