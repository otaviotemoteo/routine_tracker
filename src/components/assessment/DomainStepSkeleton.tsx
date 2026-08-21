// Mirrors DomainStep's own shape (title, boundary strip, six rating cards) —
// same markup src/app/onboarding/loading.tsx draws for a fresh navigation
// into this route. This one is for the OTHER gap: a server-action-driven
// redirect from one domain to the next stays on the same client-rendered
// form until the new page actually lands, and that transition doesn't
// reliably trip the route's own loading.tsx (a same-route, form-submit
// redirect isn't guaranteed to suspend the way a <Link> navigation does).
// DomainStep swaps to this the instant its submit goes pending, so the wait
// is never a blank hold on the outgoing domain's now-stale answers.
export function DomainStepSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Loading…
      </p>
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
    </div>
  );
}
