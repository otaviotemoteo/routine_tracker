import { getLang } from "@/lib/get-lang";

// Mirrors the results screen: title, the lead card, the chart card with twelve
// two-bar rows, then the findings.
export default async function Loading() {
  const lang = await getLang();
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-24" aria-busy="true">
      <p className="sr-only" role="status">
        {lang === "pt" ? "Carregando…" : "Loading…"}
      </p>

      <div className="flex justify-end mb-4">
        <div className="h-9 w-24 rounded-full bg-sand animate-pulse" />
      </div>

      <div className="h-3 w-28 rounded bg-sand animate-pulse mb-2" />
      <div className="h-9 w-64 max-w-full rounded bg-sand animate-pulse" />
      <div className="h-[72px] rounded-card border-2 border-sand bg-white animate-pulse mt-4" />

      <div className="h-7 w-56 max-w-full rounded bg-sand animate-pulse mt-8" />
      <div className="h-4 w-full rounded bg-sand animate-pulse mt-2" />

      <div className="border-2 border-sand rounded-card bg-white p-4 sm:p-5 mt-4">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className={i === 0 ? "" : "border-t-2 border-dashed border-sand mt-3 pt-3"}
          >
            <div className="flex justify-between gap-3">
              <div className="h-4 w-28 rounded bg-sand animate-pulse" />
              <div className="h-4 w-20 rounded bg-sand animate-pulse" />
            </div>
            <div className="h-3 rounded-full bg-sand animate-pulse mt-2" />
            <div className="h-3 rounded-full bg-sand animate-pulse mt-1.5" />
          </div>
        ))}
      </div>

      <div className="h-7 w-48 rounded bg-sand animate-pulse mt-10" />
      <div className="flex flex-col gap-3 mt-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-[132px] rounded-card border-2 border-sand bg-white animate-pulse"
          />
        ))}
      </div>
    </main>
  );
}
