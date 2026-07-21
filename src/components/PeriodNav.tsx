import Link from "next/link";
import { ChevronLeft, ChevronRight, Undo2 } from "lucide-react";

interface PeriodNavProps {
  label: string;
  prevHref: string;
  nextHref: string;
  prevAriaLabel: string;
  nextAriaLabel: string;
  // Link back to the current period; omitted when already there.
  todayHref?: string;
}

const navButtonClasses =
  "min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 rounded-full border-2 border-forest bg-white font-semibold text-sm shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm";

// Prev/next navigation shared by the week and month screens.
export function PeriodNav({
  label,
  prevHref,
  nextHref,
  prevAriaLabel,
  nextAriaLabel,
  todayHref,
}: PeriodNavProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <Link href={prevHref} aria-label={prevAriaLabel} className={navButtonClasses}>
        <ChevronLeft aria-hidden className="w-5 h-5" />
      </Link>
      <div className="flex items-center gap-3">
        <span className="font-mono font-bold text-sm sm:text-base">{label}</span>
        {todayHref && (
          <Link href={todayHref} className={navButtonClasses}>
            <Undo2 aria-hidden className="w-4 h-4" />
            Atual
          </Link>
        )}
      </div>
      <Link href={nextHref} aria-label={nextAriaLabel} className={navButtonClasses}>
        <ChevronRight aria-hidden className="w-5 h-5" />
      </Link>
    </div>
  );
}
