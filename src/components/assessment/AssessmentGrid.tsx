"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingProgress } from "@/components/onboarding/OnboardingChrome";
import { DomainStep } from "./DomainStep";
import { assessmentStepHref, prevAssessmentHref } from "@/lib/assessment";
import { TOTAL_DOMAINS, domainPosition, type DomainSlug } from "@/lib/domains";
import { format, type Copy } from "@/lib/i18n";
import type { DomainRatings, Rating } from "@/lib/diagnose";
import type { SaveDomainOutcome } from "@/app/onboarding/values-actions";

interface AssessmentGridProps {
  initialStep: DomainSlug;
  initialRatings: DomainRatings;
  action: (formData: FormData) => Promise<SaveDomainOutcome>;
  copy: Copy["assessment"];
}

// Owns "which domain is showing" as client state instead of letting it be a
// URL param a real Next.js navigation redirects to. That was the actual
// cause of the blank flash between domains: changing ?step= is what tears
// the whole tree (title, progress bar, the skeleton itself) down before the
// next page has anything to show. All twelve domains' answers-so-far are
// small enough to hold here at once, so advancing is a local state update —
// window.history.replaceState keeps the address bar honest (so a refresh or
// a bookmark still lands on the right domain) without asking the router to
// do anything.
export function AssessmentGrid({
  initialStep,
  initialRatings,
  action,
  copy,
}: AssessmentGridProps) {
  const router = useRouter();
  const [step, setStep] = useState<DomainSlug>(initialStep);
  const [ratings, setRatings] = useState<DomainRatings>(initialRatings);
  const areaNumber = domainPosition(step);

  async function handleSaved(formData: FormData): Promise<void> {
    const outcome = await action(formData);

    if (outcome.status === "sealed") {
      // The grid is genuinely done — results is a real, different page, and
      // it's fine for this one hop to be an actual navigation.
      router.push("/onboarding/results");
      return;
    }

    // Continue is disabled until all six are answered, so every key really
    // is present here — the same guarantee ratingSchema enforces server-side.
    const answered: Rating = {
      possibility: Number(formData.get("possibility")),
      importanceNow: Number(formData.get("importanceNow")),
      importanceGeneral: Number(formData.get("importanceGeneral")),
      action: Number(formData.get("action")),
      actionSatisfaction: Number(formData.get("actionSatisfaction")),
      concern: Number(formData.get("concern")),
    };
    setRatings((prev) => ({ ...prev, [step]: answered }));
    setStep(outcome.next);
    window.history.replaceState(null, "", assessmentStepHref(outcome.next));
  }

  return (
    <>
      <OnboardingProgress
        stepNumber={areaNumber}
        total={TOTAL_DOMAINS}
        label={format(copy.domainStep.eyebrow, {
          current: areaNumber,
          total: TOTAL_DOMAINS,
        })}
      />
      <DomainStep
        // Remounts on domain change — instant (a local re-render, not a page
        // load), which is exactly what resets the form's own answer state
        // for the new domain without the async gap the old design had.
        key={step}
        action={handleSaved}
        backHref={prevAssessmentHref(step)}
        slug={step}
        isLast={areaNumber === TOTAL_DOMAINS}
        copy={copy}
        initial={ratings[step] ?? {}}
      />
    </>
  );
}
