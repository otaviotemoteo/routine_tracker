import { notFound } from "next/navigation";
import { StepTitle } from "@/components/onboarding/OnboardingChrome";
import { HabitForm } from "@/components/habits/HabitForm";
import { updateHabitAction } from "../actions";
import { getHabit } from "@/db/habits";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { isDomainSlug, type DomainSlug } from "@/lib/domains";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

interface EditHabitPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; from?: string }>;
}

// The habit form, prefilled. Same component as /habits/new — the two screens
// differ only in what they start with and where they return to.
export default async function EditHabitPage({
  params,
  searchParams,
}: EditHabitPageProps) {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang].habits;
  const { id } = await params;
  const query = await searchParams;

  const habitId = Number(id);
  if (!Number.isInteger(habitId) || habitId <= 0) notFound();

  // Scoped to the owner, so another account's habit id is simply not found
  // rather than 403 — the id reveals nothing either way.
  const habit = await getHabit(userId, habitId);
  if (!habit) notFound();

  // Saving an edit returns you where you came from.
  const back = query.from === "review" ? "/onboarding/habits" : "/habits";

  const domainSlug: DomainSlug | null =
    habit.domainSlug && isDomainSlug(habit.domainSlug) ? habit.domainSlug : null;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <StepTitle backHref={back} backLabel={copy.back}>
        {copy.editTitle}
      </StepTitle>

      <HabitForm
        action={updateHabitAction}
        initial={{
          id: habit.id,
          name: habit.name,
          domainSlug,
          metricType: habit.metricType,
          unit: habit.unit ?? "",
          target: habit.target === null ? "" : String(habit.target),
          minimalAction: habit.minimalAction ?? "",
        }}
        lang={lang}
        copy={copy}
        next={back}
        cancelHref={back}
        showError={query.error === "1"}
      />
    </main>
  );
}
