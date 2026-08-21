import { getLang } from "@/lib/get-lang";
import { DomainStepSkeleton } from "@/components/assessment/DomainStepSkeleton";

// Mirrors the domain step: progress bar, then DomainStepSkeleton's own
// title/boundary/six-rating-card shape — the same component DomainStep
// itself swaps to while a submit is pending, so a fresh navigation into this
// route and a mid-flow redirect both land on the identical skeleton.
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

      <DomainStepSkeleton />
    </main>
  );
}
