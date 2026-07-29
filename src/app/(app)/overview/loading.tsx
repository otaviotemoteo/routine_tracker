import { getLang } from "@/lib/get-lang";

// Mirrors Overview — title, Week|Month tabs, period nav, the stat/bar area and
// the Activities list — so the layout doesn't jump when data arrives.
export default async function OverviewLoading() {
  const lang = await getLang();
  const statusText = lang === "pt" ? "Carregando…" : "Loading…";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8" aria-busy="true">
      <p className="sr-only" role="status">
        {statusText}
      </p>
      <div className="h-4 w-40 rounded bg-sand animate-pulse" />
      <div className="h-12 w-56 rounded bg-sand animate-pulse mt-3 mb-5" />

      {/* Week | Month */}
      <div className="flex gap-2 mb-6">
        <div className="h-11 w-24 rounded-full bg-sand animate-pulse" />
        <div className="h-11 w-24 rounded-full bg-sand animate-pulse" />
      </div>

      {/* Period navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-11 w-11 rounded-full bg-sand animate-pulse" />
        <div className="h-6 w-36 rounded bg-sand animate-pulse" />
        <div className="h-11 w-11 rounded-full bg-sand animate-pulse" />
      </div>

      {/* Per-habit rows (bars in month view, grid in week view) */}
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="rounded-card border-2 border-sand bg-white px-5 py-4"
          >
            <div className="flex justify-between mb-2">
              <div className="h-5 w-28 rounded bg-sand animate-pulse" />
              <div className="h-5 w-24 rounded bg-sand animate-pulse" />
            </div>
            <div className="h-4 rounded-full bg-sand animate-pulse" />
          </div>
        ))}
      </div>

      {/* Activities */}
      <div className="h-8 w-40 rounded bg-sand animate-pulse mt-10 mb-4" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-[64px] rounded-card border-2 border-sand bg-white animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
