import type { PanelBars } from "@/lib/today-card";

interface PanelChartProps {
  bars: PanelBars;
}

// One column per night, single series — so no legend: the caption names what is
// plotted. Values ride the accessible label rather than sitting on every
// column; the only chrome is a hairline at the target.
export function PanelChart({ bars }: PanelChartProps) {
  const { caption, columns, max, target, targetLabel } = bars;
  const plotHeight = 46;

  return (
    // Its own panel within the panel: a plot needs an edge to be read as a
    // plot rather than as loose marks floating in the card.
    <figure className="mt-1 rounded-lg border-2 border-forest/10 bg-white/60 px-2.5 pt-2 pb-1.5">
      <figcaption className="font-mono text-[0.55rem] font-bold uppercase tracking-widest text-clover/60 mb-1.5 flex items-baseline justify-between gap-2">
        <span>{caption}</span>
        {targetLabel && (
          <span className="opacity-70 normal-case tracking-normal">
            {targetLabel}
          </span>
        )}
      </figcaption>

      <div
        className="relative flex items-end gap-[2px]"
        style={{ height: plotHeight }}
      >
        {target !== undefined && target > 0 && target <= max && (
          <span
            aria-hidden
            className="absolute inset-x-0 border-t border-forest/25"
            style={{ bottom: (target / max) * plotHeight }}
          />
        )}
        {columns.map((column, i) => (
          <span
            key={i}
            title={`${column.label} · ${column.valueLabel}`}
            className="flex-1 flex flex-col justify-end min-w-0"
            style={{ height: plotHeight }}
          >
            <span className="sr-only">
              {column.label} {column.valueLabel}
            </span>
            <span
              aria-hidden
              className="w-full max-w-[14px] mx-auto bg-clover rounded-t"
              style={{
                height: Math.max(2, (column.value / max) * plotHeight),
              }}
            />
          </span>
        ))}
      </div>

      <div className="flex gap-[2px] mt-1">
        {columns.map((column, i) => (
          <span
            key={i}
            aria-hidden
            className="flex-1 text-center font-mono text-[0.5rem] font-bold opacity-40"
          >
            {column.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
