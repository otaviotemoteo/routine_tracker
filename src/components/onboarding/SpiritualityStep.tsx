"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  ghostButton,
  inputClass,
  OnboardingFooter,
} from "./OnboardingChrome";
import type { Copy } from "@/lib/i18n";

export interface PracticeDraft {
  name: string;
  slug: string;
  countable: boolean;
}

interface SpiritualityStepProps {
  action: (formData: FormData) => Promise<void>;
  next: string;
  backHref?: string;
  skipHref?: string;
  submitLabel: string;
  copy: Copy["onboarding"];
  initialPractices: PracticeDraft[];
}

export function SpiritualityStep({
  action,
  next,
  backHref,
  skipHref,
  submitLabel,
  copy,
  initialPractices,
}: SpiritualityStepProps) {
  const [rows, setRows] = useState<PracticeDraft[]>(
    initialPractices.length
      ? initialPractices
      : [{ name: "", slug: "", countable: false }]
  );

  // Preserve existing slugs; new rows send an empty slug and the server derives
  // it from the name (keeps stable identifiers for edits).
  const serialized = JSON.stringify(
    rows
      .filter((p) => p.name.trim())
      .map((p) => ({ name: p.name, slug: p.slug, countable: p.countable }))
  );

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="data" value={serialized} />
      <h1 className="display-title text-3xl sm:text-4xl">
        {copy.spirituality.title}
      </h1>
      <p className="mt-2 opacity-75">{copy.spirituality.lead}</p>

      <ul className="flex flex-col gap-3 mt-6 list-none">
        {rows.map((p, i) => (
          <li
            key={i}
            className="bg-white border-2 border-forest rounded-card shadow-hard p-4"
          >
            <div className="flex items-center gap-3">
              <input
                placeholder={copy.spirituality.name}
                aria-label={copy.spirituality.name}
                value={p.name}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r))
                  )
                }
                className={inputClass}
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  aria-label={copy.spirituality.removePractice}
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="min-h-[44px] min-w-[44px] shrink-0 inline-flex items-center justify-center rounded-lg border-2 border-forest bg-white"
                >
                  <X className="w-4 h-4" aria-hidden />
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 mt-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={p.countable}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, j) =>
                      j === i ? { ...r, countable: e.target.checked } : r
                    )
                  )
                }
                className="w-5 h-5 accent-clover"
              />
              {copy.spirituality.countable}
            </label>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() =>
          setRows((prev) => [...prev, { name: "", slug: "", countable: false }])
        }
        className={`${ghostButton} mt-4`}
      >
        <Plus className="w-4 h-4 mr-1.5" aria-hidden />
        {copy.spirituality.addPractice}
      </button>

      <OnboardingFooter
        backHref={backHref}
        skipHref={skipHref}
        skipLabel={copy.skip}
        backLabel={copy.back}
        submitLabel={submitLabel}
      />
    </form>
  );
}
