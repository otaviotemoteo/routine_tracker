import { getLang } from "@/lib/get-lang";

// Skeleton for Overview: title, tabs, period nav and a large card placeholder
// that fits both the week grid and the month bars.
export default async function OverviewLoading() {
  const lang = await getLang();
  const statusText = lang === "pt" ? "Carregando…" : "Loading…";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8" aria-busy="true">
      <p className="sr-only" role="status">
        {statusText}
      </p>
      <div className="h-4 w-40 rounded bg-sand animate-pulse" />
      <div className="h-12 w-56 rounded bg-sand animate-pulse mt-3 mb-6" />
      <div className="flex gap-2 mb-6">
        <div className="h-11 w-24 rounded-full bg-sand animate-pulse" />
        <div className="h-11 w-24 rounded-full bg-sand animate-pulse" />
      </div>
      <div className="flex justify-between mb-5">
        <div className="h-11 w-11 rounded-full bg-sand animate-pulse" />
        <div className="h-11 w-40 rounded-full bg-sand animate-pulse" />
        <div className="h-11 w-11 rounded-full bg-sand animate-pulse" />
      </div>
      <div className="h-72 rounded-card border-2 border-sand bg-white animate-pulse" />
    </div>
  );
}
