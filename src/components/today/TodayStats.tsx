import type { Copy } from "@/lib/i18n";

interface TodayStatsProps {
  done: number;
  total: number;
  streak: number;
  copy: Copy["today"];
}

// The day in two figures, beside the title: how much of today is in, and how
// long the run of complete days is.
export function TodayStats({ done, total, streak, copy }: TodayStatsProps) {
  return (
    <div className="shrink-0 flex items-center gap-3 bg-white border-2 border-forest rounded-card px-3.5 py-2.5">
      <div>
        <p className="font-mono font-bold text-lg leading-none">
          {done}
          <span className="opacity-40">/{total}</span>
        </p>
        <p className="text-[0.6rem] font-semibold uppercase tracking-wider opacity-55 mt-1">
          {copy.statDone}
        </p>
      </div>
      <div aria-hidden className="w-px h-7 bg-sand" />
      <div>
        <p className="font-mono font-bold text-lg leading-none text-straw">
          {streak}
        </p>
        <p className="text-[0.6rem] font-semibold uppercase tracking-wider opacity-55 mt-1">
          {copy.statStreak}
        </p>
      </div>
    </div>
  );
}
