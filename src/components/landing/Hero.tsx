import type { Copy } from "@/lib/i18n";

interface HeroProps {
  copy: Copy["landing"];
}

export function Hero({ copy }: HeroProps) {
  return (
    <header className="pt-6 sm:pt-12 text-center flex flex-col items-center">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="display-title text-4xl sm:text-6xl leading-tight mt-3">
        {copy.titlePre} <span className="text-clover">{copy.titleAccent}</span>
      </h1>
      <p className="mt-4 max-w-[56ch] text-lg opacity-75">{copy.lead}</p>
    </header>
  );
}
