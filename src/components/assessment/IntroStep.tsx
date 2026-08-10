import { Check, ExternalLink } from "lucide-react";
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
export function IntroStep({ action, copy }: IntroStepProps) {
  return (
    <div>
      <p className="eyebrow mb-2">{copy.intro.eyebrow}</p>
      <h1 className="display-title text-3xl sm:text-4xl">{copy.intro.title}</h1>
      <p className="mt-3 text-lg opacity-80">{copy.intro.lead}</p>
      <p className="mt-2 font-mono text-sm text-clover font-semibold">
        {copy.intro.time}
      </p>

      {/* The three points are one explanation of the questions, so they are one
          card with a title, not three loose ticks on the page. */}
      <section className={`${cardSurface} mt-6 px-4 py-4`}>
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
        <button type="submit" className={primaryButton}>
          {copy.intro.start}
        </button>
      </form>
    </div>
  );
}
