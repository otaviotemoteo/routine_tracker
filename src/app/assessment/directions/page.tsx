import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSelect } from "@/components/landing/LanguageSelect";
import { OnboardingProgress } from "@/components/onboarding/OnboardingChrome";
import { primaryButton } from "@/components/ui/styles";
import { DirectionStep } from "@/components/assessment/DirectionStep";
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
// The list of domains comes from the sealed assessment's frozen
// priority_domains, never from re-running the engine. If it were recomputed,
// a later change to the thresholds would silently move a past cycle's list
// while its narratives stayed attached to domains no longer on it.
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

  if (params.done) {
    return (
      <Shell lang={lang}>
        <h1 className="display-title text-3xl sm:text-4xl">
          {copy.directions.doneTitle}
        </h1>
        <p className="mt-3 opacity-80">{copy.directions.doneLead}</p>
        <Link href="/overview" className={`${primaryButton} mt-8`}>
          {copy.directions.doneAction}
        </Link>
      </Shell>
    );
  }

  const requested = params.domain;
  const slug =
    requested && isDomainSlug(requested) && priority.includes(requested)
      ? requested
      : priority[0];
  const index = priority.indexOf(slug);
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
        backHref={index === 0 ? "/assessment/results" : href(index - 1)}
        slug={slug}
        isLast={isLast}
        copy={copy}
        unsaved={COPY[lang].onboarding.unsaved}
        initialReflection={written[slug]?.rawReflection ?? ""}
        initialNarrative={written[slug]?.narrative ?? ""}
      />
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
