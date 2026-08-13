import { StepTitle } from "@/components/onboarding/OnboardingChrome";
import { HabitForm } from "@/components/habits/HabitForm";
import { createHabitAction } from "../actions";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { isDomainSlug, type DomainSlug } from "@/lib/domains";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

interface NewHabitPageProps {
  searchParams: Promise<{
    error?: string;
    area?: string;
    from?: string;
  }>;
}

// The habit form, empty. An editing screen: one job, one primary action.
export default async function NewHabitPage({ searchParams }: NewHabitPageProps) {
  await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang].habits;
  const params = await searchParams;

  // Added from the review screen: the habit joins the proposed set rather than
  // being tracked immediately, and both Cancel and Save return there.
  const fromReview = params.from === "review";
  const back = fromReview ? "/habits/review" : "/habits";

  // Adding a habit from inside an area's group prefills that area, so the
  // most common case needs no dropdown at all.
  const area: DomainSlug | null =
    params.area && isDomainSlug(params.area) ? params.area : null;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <StepTitle backHref={back} backLabel={copy.back}>
        {copy.newTitle}
      </StepTitle>

      <HabitForm
        action={createHabitAction}
        initial={{
          name: "",
          domainSlug: area,
          metricType: "binary",
          unit: "",
          target: "",
          minimalAction: "",
        }}
        lang={lang}
        copy={copy}
        next={back}
        cancelHref={back}
        proposed={fromReview}
        showError={params.error === "1"}
      />
    </main>
  );
}
