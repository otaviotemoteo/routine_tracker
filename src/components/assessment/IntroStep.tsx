import { Check } from "lucide-react";
import { primaryButton } from "@/components/onboarding/OnboardingChrome";
import type { Copy } from "@/lib/i18n";

interface IntroStepProps {
  action: () => Promise<void>;
  copy: Copy["assessment"];
}

// The screen that decides whether anyone finishes this.
//
// It is asking for twenty minutes and six answers about twelve areas of
// somebody's life, so it says up front what it wants, what it will do with it,
// and the two things people would otherwise get wrong: that a low answer is
// allowed, and that hiding their last answers is deliberate rather than a
// missing feature.
export function IntroStep({ action, copy }: IntroStepProps) {
  return (
    <div>
      <p className="eyebrow mb-2">{copy.intro.eyebrow}</p>
      <h1 className="display-title text-3xl sm:text-4xl">{copy.intro.title}</h1>
      <p className="mt-3 text-lg opacity-80">{copy.intro.lead}</p>
      <p className="mt-2 font-mono text-sm text-clover font-semibold">
        {copy.intro.time}
      </p>

      <ul className="flex flex-col gap-2.5 mt-6 list-none">
        {copy.intro.items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <Check className="w-4 h-4 mt-1 shrink-0 text-clover" aria-hidden />
            <span className="text-sm">{item}</span>
          </li>
        ))}
      </ul>

      {/* Straw, because both of these are things to act on while answering,
          not settled state. */}
      <div className="mt-5 flex flex-col gap-3">
        <p className="text-sm bg-straw/15 border-2 border-forest rounded-card px-4 py-3">
          {copy.intro.hidden}
        </p>
        <p className="text-sm bg-straw/15 border-2 border-forest rounded-card px-4 py-3">
          {copy.intro.notApplicable}
        </p>
      </div>

      {/* These questions come out of a clinical instrument. Saying so once is
          honest, and it costs nothing. */}
      <p className="mt-5 text-sm opacity-70 border-l-2 border-sand pl-4">
        {copy.intro.caution}
      </p>

      <form action={action} className="mt-8">
        <button type="submit" className={primaryButton}>
          {copy.intro.start}
        </button>
      </form>
    </div>
  );
}
