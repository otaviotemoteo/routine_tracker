import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";

// The pending state for a generation.
//
// This is the only route in the app that is genuinely slow — everything else
// is a sub-second query — so it is the only one that needed a real waiting
// design rather than a spinner. Two things make it that:
//
//   It says what is happening and roughly how long. A model call is 5–20
//   seconds, which is long enough that an unexplained wait reads as a hang.
//
//   It mirrors the layout it replaces. The blocks below are the real habit
//   card sizes under their real area headings, so nothing jumps when the
//   suggestions land. A centred spinner would guarantee a jump.
//
// Every pulse is motion-safe: globals.css collapses animation under
// prefers-reduced-motion, and a page that is entirely animation would
// otherwise become a page that is entirely nothing.
export default async function Loading() {
  const lang = await getLang();
  const copy = COPY[lang].habits;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24" aria-busy="true">
      <p className="eyebrow">{copy.reviewEyebrow}</p>
      <h1 className="display-title text-3xl sm:text-4xl mt-1">
        {copy.generating}
      </h1>
      {/* role=status so a screen reader is told this is a wait, not a result. */}
      <p role="status" className="mt-2 mb-8 opacity-75 max-w-prose">
        {copy.generatingLead}
      </p>

      {/* Two areas, three cards — the shape a generation usually returns. */}
      <div className="flex flex-col gap-7">
        {[0, 1].map((group) => (
          <section key={group}>
            <div className="h-4 w-32 rounded bg-sand animate-pulse mb-2.5" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: group === 0 ? 3 : 2 }, (_, i) => (
                <div
                  key={i}
                  className="border-2 border-forest rounded-card bg-white shadow-hard p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-sand animate-pulse" />
                    <div className="min-w-0 flex-1">
                      <div className="h-6 w-2/3 rounded bg-sand animate-pulse" />
                      <div className="h-4 w-1/3 rounded bg-sand animate-pulse mt-2" />
                      {/* The minimal-action band, which is what makes these
                          cards as tall as they are. */}
                      <div className="h-8 rounded-lg bg-sand animate-pulse mt-2.5" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end mt-3">
                    <div className="h-11 w-24 rounded-full bg-sand animate-pulse" />
                    <div className="h-11 w-28 rounded-full bg-sand animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
