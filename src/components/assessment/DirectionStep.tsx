"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ghostButton, inputClass, primaryButton } from "@/components/ui/styles";
import { DirectionStepSkeleton } from "./DirectionStepSkeleton";
import type { DomainSlug } from "@/lib/domains";
import { type Copy } from "@/lib/i18n";

interface DirectionStepProps {
  action: (formData: FormData) => Promise<void>;
  next: string;
  backHref?: string;
  slug: DomainSlug;
  submitLabel: string;
  copy: Copy["assessment"];
  unsaved: Copy["onboarding"]["unsaved"];
  initialReflection: string;
  initialNarrative: string;
}

// One priority domain: the worksheet's writing prompt, then the one sentence.
//
// Unlike the rating steps, this one guards its exit. These are long free-text
// fields written slowly, and a mis-tapped Back that silently drops a paragraph
// is a different order of loss than a re-draggable slider.
//
// Submission goes through useTransition rather than plain <form action> +
// useFormStatus — see DomainStep's own comment for why: useFormStatus's
// `pending` went false as soon as `action` returned, before the NEXT
// direction's page had actually finished loading, which showed up as a
// blank flash between the skeleton and the real content. startTransition
// keeps `isPending` true across the redirect too.
export function DirectionStep({
  action,
  next,
  backHref,
  slug,
  submitLabel,
  copy,
  unsaved,
  initialReflection,
  initialNarrative,
}: DirectionStepProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reflection, setReflection] = useState(initialReflection);
  const [narrative, setNarrative] = useState(initialNarrative);
  const [isPending, startTransition] = useTransition();
  const domain = copy.domains[slug];

  const dirty =
    reflection !== initialReflection || narrative !== initialNarrative;

  function goBack() {
    if (!backHref) return;
    if (dirty) dialogRef.current?.showModal();
    else router.push(backHref);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await action(formData);
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="domain" value={slug} />

      {isPending ? (
        <DirectionStepSkeleton />
      ) : (
        <>
          {/* The progress bar above already carries "Direction n of 5". */}
          <h1 className="display-title text-3xl sm:text-4xl">{domain.name}</h1>
          <p className="mt-2 opacity-75">{copy.directions.lead}</p>

          {/* The prompt and the boundary stay on screen while writing: this
              is the one screen where having to remember the question would
              cost you the answer. */}
          <div className="mt-5 border-2 border-forest rounded-card bg-mint px-4 py-3.5">
            <p className="font-semibold">{domain.prompt}</p>
            <p className="mt-1.5 text-sm opacity-75">{domain.boundary}</p>
          </div>

          <label htmlFor="rawReflection" className="block mt-6 mb-1 font-semibold text-sm">
            {copy.directions.reflectionLabel}
          </label>
          <p className="mb-2 text-sm opacity-70">{copy.directions.reflectionHelp}</p>
          {/* Fixed height and white: resizable fields make the page jump
              while you write, and cream reads as disabled next to the white
              cards around it. */}
          <textarea
            id="rawReflection"
            name="rawReflection"
            rows={7}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            className={`${inputClass} bg-white py-2.5 leading-relaxed resize-none`}
          />

          <label htmlFor="narrative" className="block mt-6 mb-1 font-semibold text-sm">
            {copy.directions.narrativeLabel}
          </label>
          <p className="mb-2 text-sm opacity-70">{copy.directions.narrativeHelp}</p>
          <textarea
            id="narrative"
            name="narrative"
            rows={3}
            placeholder={copy.directions.narrativePlaceholder}
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            className={`${inputClass} bg-white py-2.5 leading-relaxed resize-none`}
          />

          <div className="flex items-center justify-between gap-3 flex-wrap mt-7">
            <div>
              {backHref && (
                <button type="button" onClick={goBack} className={ghostButton}>
                  {copy.back}
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={narrative.trim().length === 0 || isPending}
              className={primaryButton}
            >
              {isPending && (
                <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {isPending ? copy.saving : submitLabel}
            </button>
          </div>
        </>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="unsaved-direction-title"
        className="bg-transparent p-0 backdrop:bg-forest/40"
      >
        <div className="bg-white border-2 border-forest rounded-card shadow-hard p-6 w-[min(26rem,92vw)] text-forest">
          <h2 id="unsaved-direction-title" className="display-title text-xl">
            {unsaved.title}
          </h2>
          <p className="mt-2 opacity-75 text-sm">{unsaved.text}</p>
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={`${ghostButton} flex-1 whitespace-nowrap`}
            >
              {unsaved.keepEditing}
            </button>
            <button
              type="button"
              onClick={() => {
                dialogRef.current?.close();
                if (backHref) router.push(backHref);
              }}
              className={`${primaryButton} flex-1 whitespace-nowrap`}
            >
              {unsaved.leave}
            </button>
          </div>
        </div>
      </dialog>
    </form>
  );
}
