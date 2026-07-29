import { getLang } from "@/lib/get-lang";

// Mirrors the Today board — eyebrow, title, progress card, the single CTA and
// the 2-column card grid — so nothing shifts when the real content lands.
export default async function Loading() {
  const lang = await getLang();
  const statusText = lang === "pt" ? "Carregando…" : "Loading…";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8" aria-busy="true">
      <p className="sr-only" role="status">
        {statusText}
      </p>
      <div className="h-4 w-44 rounded bg-sand animate-pulse" />
      <div className="h-12 w-40 rounded bg-sand animate-pulse mt-3 mb-7" />

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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className="h-[104px] rounded-card border-2 border-sand bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <div className="w-6 h-6 rounded bg-sand animate-pulse" />
                <div className="w-[30px] h-[30px] rounded-lg bg-sand animate-pulse" />
              </div>
              <div className="h-4 w-20 rounded bg-sand animate-pulse mt-2.5" />
              <div className="h-3 w-24 rounded bg-sand animate-pulse mt-1.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
