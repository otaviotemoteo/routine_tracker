import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";

// Mirrors the activities screen: title/lead (real copy, not skeleton — it's
// static regardless of what loads), then a few habit-card-shaped pulses.
export default async function Loading() {
  const lang = await getLang();
  const copy = COPY[lang].activities;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-24" aria-busy="true">
      <p className="sr-only" role="status">
        {lang === "pt" ? "Carregando…" : "Loading…"}
      </p>

      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="display-title text-3xl sm:text-4xl mt-1">{copy.title}</h1>
      <p className="mt-2 mb-6 opacity-75 max-w-prose">{copy.lead}</p>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="rounded-card border-2 border-sand bg-white p-4"
          >
            <div className="h-5 w-1/3 rounded bg-sand animate-pulse mb-3" />
            <div className="flex gap-2">
              {Array.from({ length: 5 }, (_, j) => (
                <div
                  key={j}
                  className="w-11 h-11 rounded-lg bg-sand animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="h-12 w-48 rounded-full bg-sand animate-pulse mt-6" />
    </main>
  );
}
