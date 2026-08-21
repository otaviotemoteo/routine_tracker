// Mirrors DirectionStep's own shape (title, the mint prompt/boundary card,
// the two labelled textareas) for the same reason DomainStepSkeleton exists:
// the redirect from one direction to the next is a server-action navigation
// that doesn't reliably trip the route's own loading.tsx, so DirectionStep
// swaps to this the instant its submit goes pending.
export function DirectionStepSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Loading…
      </p>
      <div className="h-9 w-48 rounded bg-sand animate-pulse" />
      <div className="h-4 w-2/3 rounded bg-sand animate-pulse mt-3" />

      <div className="mt-5 border-2 border-sand rounded-card bg-white px-4 py-3.5">
        <div className="h-4 w-3/4 rounded bg-sand animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-sand animate-pulse mt-2.5" />
      </div>

      <div className="h-4 w-40 rounded bg-sand animate-pulse mt-6 mb-1" />
      <div className="h-3 w-2/3 rounded bg-sand animate-pulse mb-2" />
      <div className="h-[168px] rounded-card bg-sand animate-pulse" />

      <div className="h-4 w-40 rounded bg-sand animate-pulse mt-6 mb-1" />
      <div className="h-3 w-1/2 rounded bg-sand animate-pulse mb-2" />
      <div className="h-[84px] rounded-card bg-sand animate-pulse" />

      <div className="flex items-center justify-between gap-3 mt-7">
        <div className="h-11 w-20 rounded-full bg-sand animate-pulse" />
        <div className="h-12 w-32 rounded-full bg-sand animate-pulse" />
      </div>
    </div>
  );
}
