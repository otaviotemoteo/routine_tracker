import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AssessmentShell } from "@/components/assessment/AssessmentShell";
import { StepTitle } from "@/components/onboarding/OnboardingChrome";
import { AreaCards } from "@/components/assessment/AreaCards";
import { AddAreaPicker } from "@/components/assessment/AddAreaPicker";
import { goToHabitsAction } from "./actions";
import { getLatestSealed, listDirectionNarratives } from "@/db/assessment";
import { canGenerate } from "@/lib/ai/harness";
import { rankByGap } from "@/lib/diagnose";
import { DOMAIN_SLUGS, isDomainSlug } from "@/lib/domains";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { primaryButton } from "@/components/ui/styles";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

// The areas review — the screen between the directions and the habits.
//
// It exists for four reasons, and only the first is obvious:
//
//   1. It sets expectations about a wait. Every other route in this app is a
//      sub-second query; this is the one that hands off to something slow.
//   2. It is the last moment the cut of five can be corrected, by a person
//      rather than by arithmetic.
//   3. It is the consent step. This is the first time anything someone wrote
//      leaves the machine, and finding that out afterwards is the wrong way to
//      find it out.
//   4. It is where "no API key" degrades with no dead end — the same screen,
//      with the button saying "Add habits manually".
//
// A reporting screen with exactly one primary action. Editing an area means
// leaving for the direction form, which is a screen that edits.
export default async function AreasPage() {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang].assessment;

  const sealed = await getLatestSealed(userId);
  if (!sealed) redirect("/assessment");

  const written = await listDirectionNarratives(userId, sealed.cycleId);
  const priority = sealed.priorityDomains.filter(isDomainSlug);

  // What the cycle is actually about: the frozen cut, plus any area added by
  // writing a direction for it. Reading the additions back out of the
  // narratives — rather than out of a second column — is what lets
  // priority_domains stay untouched.
  const added = DOMAIN_SLUGS.filter(
    (slug) => !priority.includes(slug) && written[slug]?.narrative?.trim()
  );
  const building = [...priority, ...added];

  // Whether the harness could answer at all right now: no provider key, or
  // today's quota already spent. Decided before any I/O, which is the whole
  // reason the button can be absent rather than present-and-failing.
  const generates = await canGenerate(userId);

  const remaining = rankByGap(sealed.ratings).filter(
    (row) => !building.includes(row.domainSlug)
  );

  return (
    <AssessmentShell lang={lang} navCopy={COPY[lang].nav} chrome="nav">
      <p className="eyebrow mb-2">{copy.areas.eyebrow}</p>
      <StepTitle
        backHref="/assessment/directions"
        backLabel={copy.directions.indexTitle}
      >
        {copy.areas.title}
      </StepTitle>
      <p className="mt-2 mb-6 opacity-75">{copy.areas.lead}</p>

      {building.length === 0 ? (
        // Reachable by typing the URL before any direction is written. Sends
        // them to the screen that fills the gap rather than offering a
        // generate button with nothing to generate from.
        <div className="border-2 border-forest rounded-card bg-white shadow-hard px-6 py-8 text-center">
          <h2 className="display-title text-2xl">{copy.areas.empty}</h2>
          <Link href="/assessment/directions" className={`${primaryButton} mt-6`}>
            {copy.areas.emptyAction}
          </Link>
        </div>
      ) : (
        <>
          <AreaCards areas={building} written={written} copy={copy} />

          <AddAreaPicker remaining={remaining} copy={copy} />

          {/* One primary action, and the sentence under it says what pressing
              it does. The note is not fine print — it is the consent. */}
          <form action={goToHabitsAction} className="mt-10">
            <input
              type="hidden"
              name="generate"
              value={generates ? "1" : "0"}
            />
            <button type="submit" className={`${primaryButton} w-full sm:w-auto`}>
              {generates && <Sparkles className="w-5 h-5" aria-hidden />}
              {generates ? copy.areas.generate : copy.areas.manual}
            </button>
            <p className="mt-3 text-sm opacity-75 max-w-prose">
              {generates ? copy.areas.generateNote : copy.areas.manualNote}
            </p>
          </form>
        </>
      )}
    </AssessmentShell>
  );
}
