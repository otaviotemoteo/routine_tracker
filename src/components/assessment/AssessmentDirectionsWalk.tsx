"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingProgress } from "@/components/onboarding/OnboardingChrome";
import { DirectionStep } from "./DirectionStep";
import type { DomainSlug } from "@/lib/domains";
import { format, type Copy } from "@/lib/i18n";

interface WrittenEntry {
  rawReflection: string;
  narrative: string;
}

interface AssessmentDirectionsWalkProps {
  priority: DomainSlug[];
  initialIndex: number;
  initialWritten: Record<string, WrittenEntry>;
  action: (formData: FormData) => Promise<void>;
  indexHref: string;
  copy: Copy["assessment"];
  unsaved: Copy["onboarding"]["unsaved"];
}

// The ordered first-and-only walk through the priority directions — the one
// sub-case of /onboarding/directions with repeated domain-to-domain hops, so
// it's the one that actually needs AssessmentGrid's own trick: hold the
// current index as client state instead of a URL a real navigation redirects
// to, so the wait between directions never tears the title/progress
// bar/skeleton down. The "reviewing one in place" and "editing from areas"
// shapes are both single hops back to a fixed destination — page.tsx keeps
// those as ordinary server redirects, since there's no repeated flash to fix
// there. Reaching the end of the walk (chrome switches from focus to nav) is
// a real navigation too, same reasoning as the grid's "sealed" → results.
export function AssessmentDirectionsWalk({
  priority,
  initialIndex,
  initialWritten,
  action,
  indexHref,
  copy,
  unsaved,
}: AssessmentDirectionsWalkProps) {
  const router = useRouter();
  const [index, setIndex] = useState(initialIndex);
  const [written, setWritten] = useState(initialWritten);
  const slug = priority[index];
  const isLast = index === priority.length - 1;

  async function handleSaved(formData: FormData): Promise<void> {
    await action(formData);

    const rawReflection = String(formData.get("rawReflection") ?? "");
    const narrative = String(formData.get("narrative") ?? "");
    setWritten((prev) => ({ ...prev, [slug]: { rawReflection, narrative } }));

    if (isLast) {
      router.push(`${indexHref}?done=1`);
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    window.history.replaceState(null, "", `${indexHref}?domain=${priority[nextIndex]}`);
  }

  return (
    <>
      <OnboardingProgress
        stepNumber={index + 1}
        total={priority.length}
        label={format(copy.directions.eyebrow, {
          current: index + 1,
          total: priority.length,
        })}
      />
      <DirectionStep
        // Instant remount on domain change, same reasoning as AssessmentGrid's
        // DomainStep — resets the textareas' local state with no async gap.
        key={slug}
        action={handleSaved}
        // Inert here — saveDirectionAdvance doesn't redirect, so nothing
        // reads this. Still required by DirectionStep's props because its
        // other two callers (reviewing, editing from areas) do redirect.
        next={indexHref}
        backHref={index === 0 ? indexHref : `${indexHref}?domain=${priority[index - 1]}`}
        slug={slug}
        submitLabel={isLast ? copy.directions.finish : copy.directions.save}
        copy={copy}
        unsaved={unsaved}
        initialReflection={written[slug]?.rawReflection ?? ""}
        initialNarrative={written[slug]?.narrative ?? ""}
      />
    </>
  );
}
