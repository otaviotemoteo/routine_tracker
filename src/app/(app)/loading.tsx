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

        <div
          className="grid gap-3.5 sm:gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gridAutoRows: "1fr",
          }}
        >
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className="h-[188px] rounded-card border-2 border-sand bg-white p-4 flex flex-col"
            >
              <div className="flex items-start justify-between">
                <div className="h-4 w-20 rounded bg-sand animate-pulse" />
                <div className="h-[22px] w-16 rounded-full bg-sand animate-pulse" />
              </div>
              {/* Hero number + unit */}
              <div className="h-9 w-16 rounded bg-sand animate-pulse mt-3" />
              {/* The context panel takes the slack, as it does on a real card */}
              <div className="flex-1 min-h-[52px] rounded-lg bg-sand animate-pulse mt-2.5" />
              <div className="h-[40px] rounded-lg bg-sand animate-pulse mt-2.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
