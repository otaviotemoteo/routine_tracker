import Link from "next/link";
import { Sparkles } from "lucide-react";
import { habitName, format, type Copy, type Lang } from "@/lib/i18n";

interface TemplatesNudgeProps {
  habitNames: { slug: string; name: string }[];
  lang: Lang;
  copy: Copy["today"];
}

const PREVIEW_COUNT = 3;

// Today's first-run invitation into the card-style chooser — shown for as
// long as any tracked activity is still the bare, untouched default, not
// just once. There used to be a "seen it, dismiss for good" cookie here
// (both the CTA and a "Not now" both set it), but a one-time dismissal is
// exactly what let an unaddressed default card end up visible with no
// nudge next to it: dismissing must not outlive the state it was about.
// Derived, not remembered — same principle as everywhere else this app
// avoids a stored flag when the database already knows the answer. The mini-
// cards are illustrative only — real content, deliberately blurred, so
// screen readers skip straight to the heading and the one real action
// rather than reading fabricated numbers as data.
//
// Blur is otherwise foreign to this design system ("hard shadows, never
// blurred" — UX_PRINCIPLES.md), so it's used here on purpose and only here:
// the one moment the app is showing something that ISN'T the real card yet.
export function TemplatesNudge({ habitNames, lang, copy }: TemplatesNudgeProps) {
  const preview = habitNames.slice(0, PREVIEW_COUNT);

  return (
    <div className="border-2 border-dashed border-straw bg-white rounded-card shadow-hard px-4 py-4 flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <Sparkles className="w-[18px] h-[18px] mt-0.5 shrink-0 text-straw" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="display-title text-lg leading-snug">
            {format(copy.templatesNudgeTitle, { n: habitNames.length })}
          </p>
          <p className="mt-1 text-sm font-semibold text-straw">
            {copy.templatesNudgeLead}
          </p>
        </div>
      </div>

      <Link
        href="/habits/templates?from=today"
        className="min-h-[44px] inline-flex items-center justify-center px-5 rounded-full border-2 border-forest bg-clover text-white font-semibold text-sm shadow-hard-sm w-fit"
      >
        {copy.templatesNudgeCta}
      </Link>

      {preview.length > 0 && (
        <div aria-hidden className="flex flex-col gap-2 pt-1">
          <span className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold tracking-widest opacity-45">
              {copy.templatesNudgeSectionLabel.toUpperCase()}
            </span>
            <span className="flex-1 h-px bg-sand" />
          </span>
          {preview.map((h, i) => (
            <div
              key={h.slug}
              className="border-2 border-forest rounded-lg px-3.5 py-3 overflow-hidden"
            >
              <div className="flex flex-col gap-2 blur-[2.5px] opacity-50">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded shrink-0 bg-mint" />
                  <span className="font-bold text-sm">
                    {habitName(lang, h.slug, h.name)}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono font-bold text-xl">
                    {[6, 0, 45][i] ?? 0}
                  </span>
                  <span className="text-xs opacity-70">
                    {copy.plainUnitCount}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-sand" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
