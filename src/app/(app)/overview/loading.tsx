import { getLang } from "@/lib/get-lang";

// Mirrors Overview — title, the segmented toggle, the period header with its
// stat box, the grid card, the summary cards and Activities — so the layout
// doesn't jump when data arrives.
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

      {/* Week | Month segmented control */}
      <div className="h-12 rounded-card bg-sand animate-pulse mb-5" />

      {/* Period header: title on the left, stat box on the right */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="h-3.5 w-32 rounded bg-sand animate-pulse" />
          <div className="h-9 w-44 rounded bg-sand animate-pulse mt-2" />
        </div>
        <div className="h-[58px] w-48 rounded-card border-2 border-sand bg-white animate-pulse" />
      </div>

      {/* Period navigation */}
      <div className="flex items-center justify-between mb-5">
        <div className="h-11 w-11 rounded-full bg-sand animate-pulse" />
        <div className="h-6 w-36 rounded bg-sand animate-pulse" />
        <div className="h-11 w-11 rounded-full bg-sand animate-pulse" />
      </div>

      {/* The grid or calendar card */}
      <div className="rounded-card border-2 border-sand bg-white p-4 mb-5">
        <div className="flex gap-1.5 mb-3">
          <div className="h-3 flex-1 rounded bg-sand animate-pulse" />
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-3 w-6 rounded bg-sand animate-pulse" />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, row) => (
          <div key={row} className="flex items-center gap-1.5 py-1.5">
            <div className="h-4 flex-1 rounded bg-sand animate-pulse" />
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className="h-[26px] w-6 rounded-md bg-sand animate-pulse"
              />
            ))}
          </div>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-[86px] rounded-card border-2 border-sand bg-white animate-pulse"
          />
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
