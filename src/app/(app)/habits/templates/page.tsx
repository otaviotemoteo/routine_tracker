import Link from "next/link";
import { StepTitle } from "@/components/onboarding/OnboardingChrome";
import { TemplateChooserList } from "@/components/habits/TemplateChooserList";
import { listTrackedActivities } from "@/db/habits";
import { getLang } from "@/lib/get-lang";
import { COPY, format } from "@/lib/i18n";
import { primaryButton } from "@/components/ui/styles";
import { isChoosableTemplateKind, isGenericTemplateKind } from "@/lib/templates";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

// The card-style chooser: pick how each habit's Today card looks, from the
// five generic kinds in src/lib/templates.ts. A reporting-then-editing screen
// like /config, not a status board — every choice saves the instant it's
// tapped (see actions.ts), so there's nothing to submit as a whole and no
// dirty-state to guard.
export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from, error } = await searchParams;
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang].templates;
  const todayCopy = COPY[lang].today;

  const allHabits = await listTrackedActivities(userId);
  // The seven legacy kinds aren't offered here — see src/lib/templates.ts for
  // why a chooser can't safely touch them. Showing a control for something it
  // can't act on is exactly what UX_PRINCIPLES.md rules out.
  const habits = allHabits.filter((h) => isChoosableTemplateKind(h.templateKind));
  const chosenCount = habits.filter((h) =>
    isGenericTemplateKind(h.templateKind)
  ).length;

  const backHref = from === "overview" ? "/overview" : from === "today" ? "/" : "/habits";

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24">
      <p className="eyebrow">{copy.eyebrow}</p>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <StepTitle backHref={backHref} backLabel={copy.done}>
          {copy.title}
        </StepTitle>
        {habits.length > 0 && (
          <p className="shrink-0 border-2 border-forest rounded-card bg-white px-3 py-1.5 text-right leading-none">
            <span className="block font-mono font-bold text-lg">
              {format(copy.chosenCount, { done: chosenCount, total: habits.length })}
            </span>
            <span className="block text-[10px] font-bold tracking-wider opacity-50 mt-1">
              {copy.chosenLabel.toUpperCase()}
            </span>
          </p>
        )}
      </div>
      <p className="mt-2 mb-6 opacity-75">{copy.lead}</p>

      {error === "checklist" && (
        <p
          role="alert"
          className="mb-6 border-2 border-forest bg-mint rounded-card px-4 py-3 text-sm font-semibold"
        >
          {copy.checklistNeedsOne}
        </p>
      )}

      {habits.length === 0 ? (
        <div className="border-2 border-forest rounded-card bg-white shadow-hard px-6 py-8 text-center">
          <p className="opacity-75 max-w-prose mx-auto">{copy.noEligible}</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-xs font-semibold opacity-60">
            {copy.previewNote}
          </p>
          <TemplateChooserList
            habits={habits}
            lang={lang}
            copy={copy}
            todayCopy={todayCopy}
          />
          <div className="mt-8 flex flex-col gap-3">
            <p className="text-sm opacity-70">{copy.footerNote}</p>
            <Link href={backHref} className={primaryButton}>
              {copy.done}
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
