import { redirect } from "next/navigation";
import { AssessmentShell } from "@/components/assessment/AssessmentShell";
import {
  OnboardingProgress,
  StepTitle,
} from "@/components/onboarding/OnboardingChrome";
import { CycleDoneDialog } from "@/components/assessment/CycleDoneDialog";
import { DirectionStep } from "@/components/assessment/DirectionStep";
import { DirectionsIndex } from "@/components/assessment/DirectionsIndex";
import { saveDirection } from "../values-actions";
import { getLatestSealed, listDirectionNarratives } from "@/db/assessment";
import { isDomainSlug } from "@/lib/domains";
import { getLang } from "@/lib/get-lang";
import { COPY, format } from "@/lib/i18n";
import { firstUndirected } from "@/lib/assessment";
import { isFirstRun } from "@/lib/onboarding-flow";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const INDEX_HREF = "/onboarding/directions";
const AREAS_HREF = "/onboarding/areas";

interface DirectionsPageProps {
  searchParams: Promise<{ domain?: string; done?: string; from?: string }>;
}

// The second half of the check-in: one written direction per priority domain.
//
// Three shapes, decided by the query string:
//   ?domain=<slug>  one area's form, in focus mode
//   ?done=1         the list, with the completion dialog over it
//   (neither)       the list, or the first area on a genuine first run
//
// The list of domains comes from the sealed assessment's frozen
// priority_domains, never from re-running the engine. If it were recomputed, a
// later change to the thresholds would silently move a past cycle's list while
// its narratives stayed attached to domains no longer on it.
export default async function DirectionsPage({ searchParams }: DirectionsPageProps) {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang].assessment;
  const params = await searchParams;

  const sealed = await getLatestSealed(userId);
  if (!sealed) redirect("/onboarding");

  const priority = sealed.priorityDomains.filter(isDomainSlug);
  if (priority.length === 0) redirect("/onboarding/results");

  const written = await listDirectionNarratives(userId, sealed.cycleId);
  const requested = params.domain;

  // Every area written means this visit is an edit, not a first pass — so
  // saving returns to the list rather than marching on through areas that are
  // already done.
  const reviewing = priority.every((slug) => written[slug]?.narrative?.trim());

  // The first priority domain with nothing written — the ceiling for the
  // ordered walk below, exactly like the grid's own firstUnanswered/ceiling.
  const ceiling = firstUndirected(priority, written);

  // Opened from the areas review — either one of the five being corrected, or
  // a sixth area being added through "Include another area".
  //
  // Any valid domain is accepted here, not just the frozen five, and that is
  // the whole mechanism behind adding an area: priority_domains is never
  // rewritten, so an added area is simply an area that has a direction written
  // for it. The form and the write are identical; what changes is that this is
  // a single edit rather than a position in a walk, so it carries no "n of 5"
  // and returns where it came from. Deliberately NOT subject to the ceiling
  // below — this is free, post-completion editing, not the ordered first walk.
  if (params.from === "areas" && requested && isDomainSlug(requested)) {
    return (
      <AssessmentShell lang={lang} navCopy={COPY[lang].nav} chrome="focus">
        <DirectionStep
          action={saveDirection}
          next={AREAS_HREF}
          backHref={AREAS_HREF}
          slug={requested}
          submitLabel={copy.directions.saveOnly}
          copy={copy}
          unsaved={COPY[lang].onboarding.unsaved}
          initialReflection={written[requested]?.rawReflection ?? ""}
          initialNarrative={written[requested]?.narrative ?? ""}
        />
      </AssessmentShell>
    );
  }

  if (requested && isDomainSlug(requested) && priority.includes(requested)) {
    // The ceiling: backwards (revising a written domain) is free, forwards
    // past the first undirected one is not — mirrors resolveAssessmentStep's
    // "backwards is free, forwards is not" exactly, just for directions.
    if (ceiling && priority.indexOf(requested) > priority.indexOf(ceiling)) {
      redirect(`${INDEX_HREF}?domain=${ceiling}`);
    }

    const index = priority.indexOf(requested);
    const isLast = index === priority.length - 1;
    const href = (i: number) => `${INDEX_HREF}?domain=${priority[i]}`;

    return (
      <AssessmentShell lang={lang} navCopy={COPY[lang].nav} chrome="focus">
        <OnboardingProgress
          stepNumber={index + 1}
          total={priority.length}
          label={format(copy.directions.eyebrow, {
            current: index + 1,
            total: priority.length,
          })}
        />
        <DirectionStep
          action={saveDirection}
          next={
            reviewing
              ? INDEX_HREF
              : isLast
                ? `${INDEX_HREF}?done=1`
                : href(index + 1)
          }
          backHref={reviewing || index === 0 ? INDEX_HREF : href(index - 1)}
          slug={requested}
          submitLabel={
            reviewing
              ? copy.directions.saveOnly
              : isLast
                ? copy.directions.finish
                : copy.directions.save
          }
          copy={copy}
          unsaved={COPY[lang].onboarding.unsaved}
          initialReflection={written[requested]?.rawReflection ?? ""}
          initialNarrative={written[requested]?.narrative ?? ""}
        />
      </AssessmentShell>
    );
  }

  // Any unfinished ceiling walks straight in — a genuine first run (nothing
  // written), a stale link, or the back button landing on a partially-written
  // set all clamp to the same place: the first area still missing a direction.
  if (!params.done && ceiling) {
    redirect(`${INDEX_HREF}?domain=${ceiling}`);
  }

  const firstRun = await isFirstRun(userId);

  return (
    <AssessmentShell lang={lang} navCopy={COPY[lang].nav} chrome="nav" firstRun={firstRun}>
      <StepTitle
        backHref="/onboarding/results"
        backLabel={copy.backToResults}
      >
        {copy.directions.indexTitle}
      </StepTitle>
      <p className="mt-2 mb-6 opacity-75">{copy.directions.indexLead}</p>

      <DirectionsIndex priority={priority} written={written} copy={copy} />

      {/* Forward, to the areas review. Sending someone back to the results
          screen they just read was the app telling them they were finished
          when the interesting half had not started. */}
      {params.done && <CycleDoneDialog href={AREAS_HREF} copy={copy} />}
    </AssessmentShell>
  );
}
