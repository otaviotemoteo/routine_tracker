"use client";

import { ArrowRight, Check, ExternalLink, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { cardSurface, primaryButton } from "@/components/ui/styles";
import type { Copy } from "@/lib/i18n";

interface IntroStepProps {
  action: () => Promise<void>;
  copy: Copy["assessment"];
}

// The screen that decides whether anyone finishes this.
//
// It is asking for twenty minutes and six answers about twelve areas of
// somebody's life, so it says up front what it wants and what it will do with
// it. What it deliberately does NOT say is that previous answers are hidden
// while you answer: that is an internal rule protecting the validity of the
// data, and telling a reader what the app is withholding only makes them
// wonder what else it is withholding.
//
// This is also, now, the first screen a brand-new account ever sees — the
// (app) gate sends anyone with no active habit here instead of the old
// manual wizard. So besides explaining the grid, it has to set the frame for
// the whole first run: priorities, directions, AI-suggested habits, and only
// then a daily check-in that's actually short. Naming that trade honestly
// (this part is slow on purpose; the rest isn't) is the point of the
// "journey" card below — undersell the effort and the grid reads as a
// bait-and-switch by domain four.
export function IntroStep({ action, copy }: IntroStepProps) {
  return (
    <div>
      {/* P1: this used to sit under its own small green eyebrow line here,
          on top of AssessmentShell's persistent "Values assessment" one
          above it — two small labels stacked ahead of one real title. One
          eyebrow (the persistent one) is chrome enough; the title below is
          the one that should read as the screen's actual name. */}
      <h1 className="display-title text-3xl sm:text-4xl">{copy.intro.title}</h1>
      <p className="mt-3 text-lg opacity-80">{copy.intro.lead}</p>
      <p className="mt-2 font-mono text-sm text-clover font-semibold">
        {copy.intro.time}
      </p>

      <section className={`${cardSurface} mt-6 px-4 py-4`}>
        <h2 className="font-semibold">{copy.intro.journeyTitle}</h2>
        <ol className="flex flex-col gap-2.5 mt-3 list-none">
          {copy.intro.journeyItems.map((item, i) => (
            <li key={item} className="flex gap-2.5">
              <ArrowRight
                className="w-4 h-4 mt-1 shrink-0 text-clover"
                aria-hidden
              />
              <span className="text-sm">
                <span className="sr-only">Step {i + 1}: </span>
                {item}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm font-semibold text-straw">
          {copy.intro.journeyNote}
        </p>
      </section>

      {/* The three points are one explanation of the questions, so they are one
          card with a title, not three loose ticks on the page. */}
      <section className={`${cardSurface} mt-4 px-4 py-4`}>
        <h2 className="font-semibold">{copy.intro.itemsTitle}</h2>
        <ul className="flex flex-col gap-2.5 mt-3 list-none">
          {copy.intro.items.map((item) => (
            <li key={item} className="flex gap-2.5">
              <Check className="w-4 h-4 mt-1 shrink-0 text-clover" aria-hidden />
              <span className="text-sm">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Straw, because this is a thing to act on while answering rather than
          settled state. */}
      <p className="mt-4 text-sm bg-straw/15 border-2 border-forest rounded-card px-4 py-3">
        {copy.intro.notApplicable}
      </p>

      {/* Where the instrument comes from, with somewhere to go and read about
          it. Assembled around the link here because copy crosses into Client
          Components and so can never carry markup. */}
      <section className={`${cardSurface} mt-4 px-4 py-4`}>
        <h2 className="font-semibold">{copy.intro.funFactTitle}</h2>
        <p className="mt-2 text-sm opacity-80">
          {copy.intro.cautionBefore}
          <a
            href={copy.intro.cautionHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-2 inline-flex items-center gap-1"
          >
            {copy.intro.cautionLink}
            <ExternalLink className="w-3 h-3" aria-hidden />
          </a>
          {copy.intro.cautionAfter}
        </p>
      </section>

      <form action={action} className="mt-8">
        <StartButton label={copy.intro.start} startingLabel={copy.intro.starting} />
      </form>
    </div>
  );
}

// P2 — disabled+spinner+"Começando…" on click, the same pattern every other
// async action in onboarding already uses.
function StartButton({
  label,
  startingLabel,
}: {
  label: string;
  startingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={primaryButton}>
      {pending && (
        <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />
      )}
      {pending ? startingLabel : label}
    </button>
  );
}
