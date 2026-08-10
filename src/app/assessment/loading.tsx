import { getLang } from "@/lib/get-lang";

// Mirrors the domain step: progress bar, title, boundary strip, six rating
// cards. The shapes are what the screen is about to become, so nothing jumps
// when it lands.
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

      <div className="h-3 w-32 rounded bg-sand animate-pulse mb-2" />
      <div className="h-3 rounded-full bg-sand animate-pulse mb-6" />

      <div className="h-9 w-48 rounded bg-sand animate-pulse" />
      <div className="h-4 w-full rounded bg-sand animate-pulse mt-3" />
      <div className="h-[58px] rounded-card bg-sand animate-pulse mt-3" />

      <div className="flex flex-col gap-3 mt-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="border-2 border-sand rounded-card bg-white px-4 py-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="h-5 flex-1 rounded bg-sand animate-pulse" />
              <div className="h-7 w-9 rounded bg-sand animate-pulse" />
            </div>
            <div className="h-4 w-3/4 rounded bg-sand animate-pulse mt-2" />
            <div className="h-3 rounded-full bg-sand animate-pulse mt-5" />
          </div>
        ))}
      </div>
    </main>
  );
}
