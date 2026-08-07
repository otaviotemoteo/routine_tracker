import { getLang } from "@/lib/get-lang";

// Mirrors the Today board — title with its stat box, progress card, the single
// CTA and the grid of equal-height habit cards — so nothing shifts when the
// real content lands.
export default async function Loading() {
  const lang = await getLang();
  const statusText = lang === "pt" ? "Carregando…" : "Loading…";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8" aria-busy="true">
      <p className="sr-only" role="status">
        {statusText}
      </p>

      {/* Title on the left, the day's two figures on the right */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="h-4 w-44 rounded bg-sand animate-pulse" />
          <div className="h-12 w-40 rounded bg-sand animate-pulse mt-3" />
        </div>
        <div className="h-[58px] w-52 rounded-card border-2 border-sand bg-white animate-pulse" />
      </div>

      <div className="flex flex-col gap-5">
        {/* Progress card */}
        <div className="border-2 border-sand bg-white rounded-card px-5 py-4">
          <div className="flex justify-between mb-2.5">
            <div className="h-5 w-24 rounded bg-sand animate-pulse" />
            <div className="h-5 w-20 rounded bg-sand animate-pulse" />
          </div>
          <div className="h-4 rounded-full bg-sand animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-sand animate-pulse mt-2.5" />
        </div>

        {/* "Complete daily" */}
        <div className="h-[52px] rounded-full bg-sand animate-pulse" />

        {/* Same grid and row height as TodayBoard, so the cards don't resize
            when the real content lands. */}
        <div
          className="grid gap-3.5 sm:gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gridAutoRows: "320px",
          }}
        >
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className="h-full overflow-hidden flex flex-col gap-2.5 p-4 rounded-card border-2 border-forest shadow-hard bg-white"
            >
              {/* Icon + name + status pill */}
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 shrink-0 rounded bg-sand animate-pulse mt-0.5" />
                <div className="h-4 flex-1 max-w-[6rem] rounded bg-sand animate-pulse" />
                <div className="h-[22px] w-16 shrink-0 rounded-full bg-sand animate-pulse" />
              </div>
              {/* Hero number + unit */}
              <div className="flex items-baseline gap-1.5">
                <div className="h-7 w-12 rounded bg-sand animate-pulse" />
                <div className="h-4 w-24 rounded bg-sand animate-pulse" />
              </div>
              {/* The context panel is the band that absorbs the height */}
              <div className="flex-1 min-h-0 rounded-lg bg-sand animate-pulse" />
              {/* Pinned note */}
              <div className="h-[46px] rounded-lg bg-sand animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
