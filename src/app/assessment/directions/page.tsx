import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSelect } from "@/components/landing/LanguageSelect";
import { OnboardingProgress } from "@/components/onboarding/OnboardingChrome";
import { ghostButton } from "@/components/ui/styles";
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

interface DirectionsPageProps {
  searchParams: Promise<{ domain?: string; done?: string }>;
}

// The second half of the check-in: one written direction per priority domain.
//
// Three shapes, decided by the query string:
//   ?domain=<slug>  one area's form
//   ?done=1         the index, with the completion dialog over it
//   (neither)       the index, or the first area on a genuine first run
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

  // One area's form.
  if (requested && isDomainSlug(requested) && priority.includes(requested)) {
    const index = priority.indexOf(requested);
    const isLast = index === priority.length - 1;
    const href = (i: number) => `/assessment/directions?domain=${priority[i]}`;
    return (
      <Shell lang={lang}>
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
          next={isLast ? "/assessment/directions?done=1" : href(index + 1)}
          backHref={index === 0 ? "/assessment/directions" : href(index - 1)}
          slug={requested}
          isLast={isLast}
          copy={copy}
          unsaved={COPY[lang].onboarding.unsaved}
          initialReflection={written[requested]?.rawReflection ?? ""}
          initialNarrative={written[requested]?.narrative ?? ""}
        />
      </Shell>
    );
  }

  // A genuine first run walks straight in. Once anything is written, arriving
  // here opens the list instead, so reaching the fifth area never costs four
  // screens you did not ask for.
  if (!params.done && Object.keys(written).length === 0) {
    redirect(`/assessment/directions?domain=${priority[0]}`);
  }

  return (
    <Shell lang={lang}>
      <h1 className="display-title text-3xl sm:text-4xl">
        {copy.directions.indexTitle}
      </h1>
      <p className="mt-2 mb-6 opacity-75">{copy.directions.indexLead}</p>

      <DirectionsIndex priority={priority} written={written} copy={copy} />

      <Link href="/assessment/results" className={`${ghostButton} mt-8`}>
        {copy.card.doneAction}
      </Link>

      {params.done && <CycleDoneDialog href="/assessment/results" copy={copy} />}
    </Shell>
  );
}

function Shell({
  lang,
  children,
}: {
  lang: "en" | "pt";
  children: React.ReactNode;
}) {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-24">
      <div className="flex justify-end mb-4">
        <LanguageSelect current={lang} />
      </div>
      {children}
    </main>
  );
}
