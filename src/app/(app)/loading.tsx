import { getLang } from "@/lib/get-lang";

// Skeleton for the Today screen while its server data loads. Mirrors the card
// layout so there is no jarring shift when content arrives.
export default async function Loading() {
  const lang = await getLang();
  const statusText = lang === "pt" ? "Carregando…" : "Loading…";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8" aria-busy="true">
      <p className="sr-only" role="status">
        {statusText}
      </p>
      <div className="h-4 w-40 rounded bg-sand animate-pulse" />
      <div className="h-12 w-52 rounded bg-sand animate-pulse mt-3 mb-7" />
      <div className="flex flex-col gap-5">
        <div className="h-24 rounded-card border-2 border-sand bg-white animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-[92px] rounded-card border-2 border-sand bg-white animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
