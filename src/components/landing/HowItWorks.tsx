import { CalendarCheck, LayoutGrid, TrendingUp } from "lucide-react";
import type { Copy } from "@/lib/i18n";

interface HowItWorksProps {
  copy: Copy["landing"];
}

const STEP_ICONS = [CalendarCheck, LayoutGrid, TrendingUp] as const;

export function HowItWorks({ copy }: HowItWorksProps) {
  return (
    <section aria-label={copy.howItWorksLabel} className="mt-14">
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {copy.steps.map((step, i) => {
          const Icon = STEP_ICONS[i] ?? CalendarCheck;
          return (
            <li
              key={step.title}
              className="bg-white border-2 border-forest rounded-card shadow-hard p-5"
            >
              <Icon aria-hidden className="w-6 h-6 text-clover" />
              <p className="font-semibold mt-2">{step.title}</p>
              <p className="text-sm opacity-75 mt-1">{step.text}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
