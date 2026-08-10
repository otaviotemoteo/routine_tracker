import { SCALE_MAX } from "@/lib/domains";

interface ScoreBarProps {
  label: string;
  value: number;
  // "{n}/10", already formatted by the caller so this stays language-free.
  valueLabel: string;
}

// One 1–10 answer as a filled bar.
//
// Both bars on a row use the SAME colour on purpose. The rule this replaces
// said colour must encode the gap and never the score, because a low answer
// must never read as a bad answer — and the first version honoured that by
// encoding three things in one track (action as a fill, importance as a tick,
// the gap as a colour ramp), which nobody could read.
//
// Two bars in one colour do not rank the person. They show two quantities of
// the same kind and let the reader take the difference from the lengths. What
// stays forbidden is colouring importance and action *differently*, or
// colouring by value, because that is the version that teaches you to produce
// a high number instead of a true one.
export function ScoreBar({ label, value, valueLabel }: ScoreBarProps) {
  const pct = Math.max(0, Math.min(1, value / SCALE_MAX)) * 100;

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[5.5rem] shrink-0 text-xs opacity-70">{label}</span>
      <div
        className="flex-1 min-w-0 h-3 rounded-full border-2 border-forest bg-white overflow-hidden"
        aria-hidden
      >
        <div className="h-full bg-clover" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-11 shrink-0 text-right font-mono text-xs tabular-nums">
        {valueLabel}
      </span>
    </div>
  );
}
