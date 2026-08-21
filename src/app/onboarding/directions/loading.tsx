import { getLang } from "@/lib/get-lang";

// Mirrors whichever shape the route resolves to. Both start with a title and a
// lead, so the skeleton commits to the list — the cheaper of the two to be
// wrong about, since the form's first paint is a single tall card.
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

      <div className="h-9 w-52 rounded bg-sand animate-pulse" />
      <div className="h-4 w-full rounded bg-sand animate-pulse mt-3" />
      <div className="h-4 w-2/3 rounded bg-sand animate-pulse mt-1.5 mb-6" />

      <div className="flex flex-col gap-3.5">
        {/* Matches DirectionsIndex's real card shape now (Screen 1's
            reskin) — icon circle, two text lines, a badge row — not the
            flat 64px bar this used to mirror, which would jump the moment
            the taller real cards land. */}
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="rounded-card border-2 border-sand bg-white px-5 py-4 flex gap-3.5"
          >
            <div className="shrink-0 w-[46px] h-[46px] rounded-full bg-sand animate-pulse" />
            <div className="min-w-0 flex-1 flex flex-col gap-2">
              <div className="h-5 w-1/3 rounded bg-sand animate-pulse" />
              <div className="h-4 rounded bg-sand animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-sand animate-pulse" />
              <div className="h-5 w-24 rounded-full bg-sand animate-pulse mt-1" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
