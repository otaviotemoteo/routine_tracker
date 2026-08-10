import Link from "next/link";
import { Check } from "lucide-react";
import { ghostButton, primaryButton } from "@/components/ui/styles";
import type { Copy } from "@/lib/i18n";

interface WelcomeStepProps {
  copy: Copy["onboarding"];
  startHref: string;
  skipHref: string;
}

export function WelcomeStep({ copy, startHref, skipHref }: WelcomeStepProps) {
  return (
    <div>
      <h1 className="display-title text-3xl sm:text-4xl">{copy.welcome.title}</h1>
      <p className="mt-2 opacity-75">{copy.welcome.lead}</p>

      <ul className="flex flex-col gap-2.5 mt-6 list-none">
        {copy.welcome.items.map((item) => (
          <li key={item} className="flex items-center gap-2.5 font-semibold">
            <span className="w-6 h-6 shrink-0 rounded-lg border-2 border-forest bg-mint inline-flex items-center justify-center">
              <Check className="w-4 h-4" strokeWidth={3} aria-hidden />
            </span>
            {item}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3 flex-wrap mt-8">
        <Link href={startHref} className={primaryButton}>
          {copy.welcome.start}
        </Link>
        <Link href={skipHref} className={ghostButton}>
          {copy.skip}
        </Link>
      </div>
    </div>
  );
}
