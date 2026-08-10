import Link from "next/link";
import { redirect } from "next/navigation";
import { AssessmentShell } from "@/components/assessment/AssessmentShell";
import { StepTitle } from "@/components/onboarding/OnboardingChrome";
import { GapBars } from "@/components/assessment/GapBars";
import { FindingCard, FindingTable } from "@/components/assessment/FindingCard";
import { PriorityList } from "@/components/assessment/PriorityList";
import { cardSurface, primaryButton } from "@/components/ui/styles";
import { getLatestSealed, listDirectionNarratives } from "@/db/assessment";
import { diagnose, gapSpread, NARROW_SPREAD, rankByGap } from "@/lib/diagnose";
import { getLang } from "@/lib/get-lang";
import { COPY, format } from "@/lib/i18n";
import { requireUserId } from "@/lib/session";
import { formatShortDayMonth } from "@/lib/utils";

export const dynamic = "force-dynamic";

// How many findings get the full treatment. The rest are listed compactly:
// everything is shown, but a wall of fourteen equally weighted cards is a wall.
const EXPANDED = 3;

// What the check-in produced.
//
// Nothing here is stored: the patterns, the distances and the ordering are all
// recomputed by the pure engine from the sealed answers. The one exception is
// the priority cut, which was frozen at sealing time precisely so that it
// cannot drift.
export default async function ResultsPage() {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang].assessment;

  const sealed = await getLatestSealed(userId);
  if (!sealed) redirect("/assessment");

  const rows = rankByGap(sealed.ratings);
  const findings = diagnose(sealed.ratings).sort((a, b) => b.severity - a.severity);
  const spread = gapSpread(sealed.ratings);
  const written = await listDirectionNarratives(userId, sealed.cycleId);
  const hasDirections = Object.keys(written).length > 0;

  return (
    <AssessmentShell lang={lang} navCopy={COPY[lang].nav} chrome="nav">
      <p className="eyebrow mb-2">{copy.results.eyebrow}</p>
      {/* The way back rides on the title, so there is one of it and nothing to
          scroll past to find it. */}
      <StepTitle backHref="/overview" backLabel={copy.backToOverview}>
        {copy.results.title}
      </StepTitle>

      {/* The one paragraph that says how to read the whole screen earns a
          surface of its own rather than floating as loose prose. */}
      <div className={`${cardSurface} mt-4 px-4 py-3.5`}>
        <p className="text-sm">{copy.results.lead}</p>
        <p className="mt-1.5 font-mono text-xs opacity-60">
          {format(copy.results.takenOn, {
            date: formatShortDayMonth(sealed.takenAt, lang),
          })}
        </p>
      </div>

      <section className="mt-8">
        <h2 className="display-title text-2xl">{copy.results.chartTitle}</h2>
        <p className="mt-2 text-sm opacity-75">{copy.results.chartLead}</p>
        <GapBars rows={rows} copy={copy} />
      </section>

      <section className="mt-10">
        <h2 className="display-title text-2xl">{copy.results.findingsTitle}</h2>

        {findings.length === 0 ? (
          <p className="mt-3 text-sm bg-mint border-2 border-forest rounded-card px-4 py-3">
            {copy.results.noFindings}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm font-semibold">
              {copy.results.findingsFirst}
            </p>
            <div className="flex flex-col gap-3 mt-3">
              {findings.slice(0, EXPANDED).map((finding) => (
                <FindingCard
                  key={`${finding.domainSlug}-${finding.pattern}`}
                  finding={finding}
                  copy={copy}
                />
              ))}
            </div>

            {findings.length > EXPANDED && (
              <>
                <p className="mt-6 text-sm font-semibold">
                  {copy.results.findingsRest}
                </p>
                <FindingTable findings={findings.slice(EXPANDED)} copy={copy} />
              </>
            )}
          </>
        )}
      </section>

      <PriorityList
        priority={sealed.priorityDomains}
        rows={rows}
        findings={findings}
        narrowSpread={spread !== null && spread < NARROW_SPREAD}
        copy={copy}
      />

      {/* Only the way forward down here: the title carries the way back, and
          stacking two of those is what the nav bar is already for. */}
      {sealed.priorityDomains.length > 0 && (
        <div className="mt-10">
          <Link href="/assessment/directions" className={primaryButton}>
            {hasDirections
              ? copy.results.reviewDirections
              : copy.results.writeDirections}
          </Link>
        </div>
      )}
    </AssessmentShell>
  );
}
