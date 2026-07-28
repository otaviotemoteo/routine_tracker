"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  ghostButton,
  inputClass,
  OnboardingFooter,
} from "./OnboardingChrome";
import type { Copy } from "@/lib/i18n";

interface DuolingoStepProps {
  action: (formData: FormData) => Promise<void>;
  next: string;
  backHref?: string;
  skipHref?: string;
  submitLabel: string;
  copy: Copy["onboarding"];
  initialLanguages: string[];
  requireDirtyToSave?: boolean;
}

const defaultNames = (): string[] => [""];

export function DuolingoStep({
  action,
  next,
  backHref,
  skipHref,
  submitLabel,
  copy,
  initialLanguages,
  requireDirtyToSave,
}: DuolingoStepProps) {
  const [names, setNames] = useState<string[]>(
    initialLanguages.length ? initialLanguages : defaultNames()
  );
  const [initialSnapshot] = useState(() =>
    JSON.stringify(initialLanguages.length ? initialLanguages : defaultNames())
  );
  const dirty = JSON.stringify(names) !== initialSnapshot;

  const serialized = JSON.stringify(
    names.filter((n) => n.trim()).map((name) => ({ name }))
  );

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="data" value={serialized} />
      <h1 className="display-title text-3xl sm:text-4xl">{copy.duolingo.title}</h1>
      <p className="mt-2 opacity-75">{copy.duolingo.lead}</p>

      <ul className="flex flex-col gap-3 mt-6 list-none">
        {names.map((name, i) => (
          <li key={i} className="flex items-center gap-3">
            <input
              placeholder={copy.duolingo.languagePlaceholder}
              aria-label={copy.duolingo.language}
              value={name}
              onChange={(e) =>
                setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))
              }
              className={inputClass}
            />
            {names.length > 1 && (
              <button
                type="button"
                aria-label={copy.duolingo.removeLanguage}
                onClick={() => setNames((prev) => prev.filter((_, j) => j !== i))}
                className="min-h-[44px] min-w-[44px] shrink-0 inline-flex items-center justify-center rounded-lg border-2 border-forest bg-white"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setNames((prev) => [...prev, ""])}
        className={`${ghostButton} mt-4`}
      >
        <Plus className="w-4 h-4 mr-1.5" aria-hidden />
        {copy.duolingo.addLanguage}
      </button>

      <OnboardingFooter
        backHref={backHref}
        skipHref={skipHref}
        skipLabel={copy.skip}
        backLabel={copy.back}
        submitLabel={submitLabel}
        copy={copy}
        dirty={dirty}
        requireDirtyToSave={requireDirtyToSave}
      />
    </form>
  );
}
