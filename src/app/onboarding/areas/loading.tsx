import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";

// Mirrors AreaCards + AddAreaPicker: the icon-circle-and-two-lines card shape,
// repeated for a typical five-priority cut, then the collapsed "Incluir outra
// área" bar and the primary action. The one route in the onboarding chain
// that had no loading.tsx at all — every other step already had one.
export default async function Loading() {
  const lang = await getLang();
  const copy = COPY[lang].assessment;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-24" aria-busy="true">
      <p className="sr-only" role="status">
        {lang === "pt" ? "Carregando…" : "Loading…"}
      </p>

      <p className="eyebrow mb-2">{copy.areas.eyebrow}</p>
      <h1 className="display-title text-3xl sm:text-4xl flex items-center gap-3">
        {copy.areas.title}
      </h1>
      <p className="mt-2 mb-6 opacity-75">{copy.areas.lead}</p>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="rounded-card border-2 border-sand bg-white p-4"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-sand animate-pulse" />
              <div className="min-w-0 flex-1">
                <div className="h-5 w-1/3 rounded bg-sand animate-pulse" />
                <div className="h-4 w-full rounded bg-sand animate-pulse mt-2.5" />
                <div className="h-4 w-2/3 rounded bg-sand animate-pulse mt-1.5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="h-12 rounded-lg border-2 border-sand bg-white animate-pulse mt-3" />

      <div className="h-11 w-48 rounded-full bg-sand animate-pulse mt-10" />
      <div className="h-4 w-64 max-w-full rounded bg-sand animate-pulse mt-3" />
    </main>
  );
}
