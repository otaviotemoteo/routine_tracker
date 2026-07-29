import Link from "next/link";
import { ChevronLeft, ChevronRight, Undo2 } from "lucide-react";

interface Stat {
  value: string;
  suffix?: string;
  label: string;
  tone?: "ink" | "clover" | "straw";
}

interface PeriodHeaderProps {
  eyebrow: string;
  title: string;
  stats: Stat[];
  prevHref: string;
  nextHref: string;
  prevAriaLabel: string;
  nextAriaLabel: string;
  // "Back to the current period"; the link is omitted when already there.
  currentLabel: string;
  currentHref?: string;
}

const toneClass = {
  ink: "text-forest",
  clover: "text-clover",
  straw: "text-straw",
} as const;

const navButton =
  "min-h-[44px] min-w-[44px] shrink-0 inline-flex items-center justify-center rounded-full border-2 border-forest bg-white shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm";

// Which period you're looking at, how to move between them, and its two
// headline figures — the same anatomy Today uses, so the app reads
// consistently. The period is named once: the arrows sit on the title itself
// rather than repeating the label in a separate nav row.
export function PeriodHeader({
  eyebrow,
  title,
  stats,
  prevHref,
  nextHref,
  prevAriaLabel,
  nextAriaLabel,
  currentLabel,
  currentHref,
}: PeriodHeaderProps) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="eyebrow">{eyebrow}</p>
        {currentHref && (
          <Link
            href={currentHref}
            className="min-h-[32px] inline-flex items-center gap-1.5 px-3 rounded-full border-2 border-forest bg-white font-semibold text-xs shadow-hard-sm"
          >
            <Undo2 aria-hidden className="w-3.5 h-3.5" />
            {currentLabel}
          </Link>
        )}
      </div>

      <div className="flex items-end justify-between gap-4 flex-wrap mt-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link href={prevHref} aria-label={prevAriaLabel} className={navButton}>
            <ChevronLeft aria-hidden className="w-5 h-5" />
          </Link>
          <h2 className="display-title text-3xl sm:text-4xl px-1 truncate">
            {title}
          </h2>
          <Link href={nextHref} aria-label={nextAriaLabel} className={navButton}>
            <ChevronRight aria-hidden className="w-5 h-5" />
          </Link>
        </div>

        <div className="shrink-0 flex items-center gap-3 bg-white border-2 border-forest rounded-card px-3.5 py-2.5 shadow-hard">
          {stats.map((stat, i) => (
            <div key={stat.label} className="flex items-center gap-3">
              {i > 0 && <span aria-hidden className="w-px h-7 bg-sand" />}
              <div>
                <p
                  className={`font-mono font-bold text-lg leading-none ${
                    toneClass[stat.tone ?? "ink"]
                  }`}
                >
                  {stat.value}
                  {stat.suffix && (
                    <span className="text-sm opacity-40">{stat.suffix}</span>
                  )}
                </p>
                <p className="text-[0.6rem] font-semibold uppercase tracking-wider opacity-55 mt-1">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
