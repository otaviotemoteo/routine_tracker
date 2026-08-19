import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AssessmentShell } from "@/components/assessment/AssessmentShell";
import { StepTitle } from "@/components/onboarding/OnboardingChrome";
import { ActivityKindPicker } from "@/components/onboarding/ActivityKindPicker";
import { generateActivitiesAction } from "./actions";
import { listHabits } from "@/db/habits";
import { isChoosableTemplateKind } from "@/lib/templates";
import { format } from "@/lib/i18n";
import { getLang } from "@/lib/get-lang";
import { COPY } from "@/lib/i18n";
import { isFirstRun } from "@/lib/onboarding-flow";
import { primaryButton, ghostButton } from "@/components/ui/styles";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

interface ActivitiesPageProps {
  searchParams: Promise<{ failed?: string }>;
}

// /config's six sections are keyed by this vocabulary, not by template kind
// — see src/app/config/page.tsx's SECTIONS. sono has no path here (it's
// never one of the five proposable kinds) but is included for completeness
// against a pre-existing habit that already carries it.
const CONFIG_SECTION: Record<string, string> = {
  treino: "workout",
  leitura: "reading",
  sono: "sleep",
  rotina: "routine",
  duolingo: "duolingo",
  espiritualidade: "spirituality",
};

// The last leg of onboarding, and the only one that isn't a gate. By the time
// this renders, "Start tracking" has already run — habits are active, the
// NavBar is already showing (isFirstRun is false the instant activation
// happened), and Today already works. This screen is a one-time OFFER, not a
// step anyone can get stuck behind: leaving via the nav is always available,
// and not picking a kind for a habit is exactly what "declining" looks like
// (HABIT-VS-ACTIVITY-MODEL.md's "empty is a signal, not a failure" — now true
// for real, see the empty-state fixes elsewhere in this phase).
export default async function ActivitiesPage({
  searchParams,
}: ActivitiesPageProps) {
  const userId = await requireUserId();
  const lang = await getLang();
  const copy = COPY[lang].activities;
  const params = await searchParams;
  const firstRun = await isFirstRun(userId);

  const all = await listHabits(userId);
  // "Plain" here means genuinely untouched by any kind — isChoosableTemplateKind
  // is the wrong predicate (it also passes the five simple card-style kinds,
  // which someone may have already picked from /habits/templates and which
  // have nothing to do with rich activities); a bare null check is the right
  // one, matching how getOrCreateSingletonHabit/promoteToRichKind think about
  // "unclaimed".
  const candidates = all.filter((h) => h.templateKind === null);
  const done = all.filter((h) => !isChoosableTemplateKind(h.templateKind));

  return (
    <AssessmentShell lang={lang} navCopy={COPY[lang].nav} chrome="nav" firstRun={firstRun}>
      <p className="eyebrow">{copy.eyebrow}</p>
      <StepTitle backLabel={copy.eyebrow}>{copy.title}</StepTitle>
      <p className="mt-2 mb-6 opacity-75">{copy.lead}</p>

      {params.failed === "1" && (
        <p className="mb-6 flex items-start gap-2.5 border-2 border-forest bg-straw/15 rounded-card px-4 py-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
          <span className="min-w-0">{copy.generateFailed}</span>
        </p>
      )}

      {done.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          <p className="text-sm font-semibold opacity-70">
            {format(copy.doneTitle, { n: done.length })}
          </p>
          <ul className="flex flex-col gap-2 list-none">
            {done.map((habit) => (
              <li
                key={habit.id}
                className="flex items-center justify-between gap-3 border-2 border-forest bg-mint rounded-card px-4 py-3"
              >
                <span className="font-semibold">{habit.name}</span>
                {/* Correct for the common case; if this account already has
                    an OLDER habit of the same kind, /config's six sections
                    still edit that older one (getHabitByTemplateKind's
                    documented "oldest wins" rule, src/db/habits.ts) — the
                    per-habit /config rebuild this defers to is what closes
                    that gap for good. */}
                {habit.templateKind && CONFIG_SECTION[habit.templateKind] && (
                  <Link
                    href={`/config?section=${CONFIG_SECTION[habit.templateKind]}`}
                    className="text-xs font-bold underline shrink-0"
                  >
                    {copy.editHint}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm opacity-75">{copy.doneLead}</p>
        </div>
      )}

      {candidates.length > 0 ? (
        <ActivityKindPicker
          habits={candidates}
          copy={copy}
          action={generateActivitiesAction}
        />
      ) : (
        done.length === 0 && <p className="opacity-75">{copy.noneLeft}</p>
      )}

      <div className="mt-8 flex items-center gap-3 flex-wrap">
        <Link href="/" className={candidates.length > 0 ? ghostButton : primaryButton}>
          {candidates.length > 0 ? copy.skip : copy.continueLabel}
        </Link>
      </div>
    </AssessmentShell>
  );
}
