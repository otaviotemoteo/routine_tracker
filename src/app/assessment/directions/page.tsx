import { redirect } from "next/navigation";
import { AssessmentShell } from "@/components/assessment/AssessmentShell";
import {
  OnboardingProgress,
  StepTitle,
} from "@/components/onboarding/OnboardingChrome";
import { CycleDoneDialog } from "@/components/assessment/CycleDoneDialog";
import { DirectionStep } from "@/components/assessment/DirectionStep";
import { DirectionsIndex } from "@/components/assessment/DirectionsIndex";
import { saveDirection } from "../actions";
import { getLatestSealed, listDirectionNarratives } from "@/db/assessment";
import { isDomainSlug } from "@/lib/domains";
import { getLang } from "@/lib/get-lang";
import { COPY, format } from "@/lib/i18n";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const INDEX_HREF = "/assessment/directions";

interface DirectionsPageProps {
  searchParams: Promise<{ domain?: string; done?: string }>;
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
  if (!sealed) redirect("/assessment");

  const priority = sealed.priorityDomains.filter(isDomainSlug);
  if (priority.length === 0) redirect("/assessment/results");

  const written = await listDirectionNarratives(userId, sealed.cycleId);
  const requested = params.domain;

  // Every area written means this visit is an edit, not a first pass — so
  // saving returns to the list rather than marching on through areas that are
  // already done.
  const reviewing = priority.every((slug) => written[slug]?.narrative?.trim());

  if (requested && isDomainSlug(requested) && priority.includes(requested)) {
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

  // A genuine first run walks straight in. Once anything is written, arriving
  // here opens the list instead, so reaching the fifth area never costs four
  // screens you did not ask for.
  if (!params.done && Object.keys(written).length === 0) {
    redirect(`${INDEX_HREF}?domain=${priority[0]}`);
  }

  return (
    <AssessmentShell lang={lang} navCopy={COPY[lang].nav} chrome="nav">
      <StepTitle
        backHref="/assessment/results"
        backLabel={copy.backToResults}
      >
        {copy.directions.indexTitle}
      </StepTitle>
      <p className="mt-2 mb-6 opacity-75">{copy.directions.indexLead}</p>

      <DirectionsIndex priority={priority} written={written} copy={copy} />

      {params.done && <CycleDoneDialog href="/assessment/results" copy={copy} />}
    </AssessmentShell>
  );
}
