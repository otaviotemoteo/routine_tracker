"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  ghostButton,
  inputClass,
  OnboardingFooter,
} from "./OnboardingChrome";
import type { Copy } from "@/lib/i18n";

export interface BookDraft {
  title: string;
  author: string;
  pages: string;
  reading: boolean;
}

interface ReadingStepProps {
  action: (formData: FormData) => Promise<void>;
  next: string;
  backHref?: string;
  skipHref?: string;
  submitLabel: string;
  copy: Copy["onboarding"];
  initialGoal: string;
  initialBooks: BookDraft[];
}

export function ReadingStep({
  action,
  next,
  backHref,
  skipHref,
  submitLabel,
  copy,
  initialGoal,
  initialBooks,
}: ReadingStepProps) {
  const [goal, setGoal] = useState(initialGoal);
  const [rows, setRows] = useState<BookDraft[]>(
    initialBooks.length
      ? initialBooks
      : [{ title: "", author: "", pages: "", reading: true }]
  );

  const serialized = JSON.stringify(
    rows
      .filter((b) => b.title.trim() && Number(b.pages) > 0)
      .map((b) => ({
        title: b.title,
        author: b.author,
        pages: Number(b.pages),
        reading: b.reading,
      }))
  );

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="data" value={serialized} />
      <h1 className="display-title text-3xl sm:text-4xl">{copy.reading.title}</h1>
      <p className="mt-2 opacity-75">{copy.reading.lead}</p>

      <label className="block mt-6 mb-1.5 font-semibold text-sm">
        {copy.reading.goal}
      </label>
      <input
        name="targetBooks"
        type="number"
        min={1}
        inputMode="numeric"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        className={`${inputClass} max-w-[8rem] font-mono`}
      />

      <p className="mt-6 mb-2 font-semibold">{copy.reading.list}</p>
      <ul className="flex flex-col gap-4 list-none">
        {rows.map((b, i) => (
          <li
            key={i}
            className="bg-white border-2 border-forest rounded-card shadow-hard p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <input
                placeholder={copy.reading.bookTitle}
                aria-label={copy.reading.bookTitle}
                value={b.title}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, j) =>
                      j === i ? { ...r, title: e.target.value } : r
                    )
                  )
                }
                className={inputClass}
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  aria-label={copy.reading.removeBook}
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="min-h-[44px] min-w-[44px] shrink-0 inline-flex items-center justify-center rounded-lg border-2 border-forest bg-white"
                >
                  <X className="w-4 h-4" aria-hidden />
                </button>
              )}
            </div>
            <div className="flex gap-3 mt-3">
              <input
                placeholder={copy.reading.author}
                aria-label={copy.reading.author}
                value={b.author}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, j) =>
                      j === i ? { ...r, author: e.target.value } : r
                    )
                  )
                }
                className={inputClass}
              />
              <input
                placeholder={copy.reading.pages}
                aria-label={copy.reading.pages}
                type="number"
                min={1}
                inputMode="numeric"
                value={b.pages}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, j) =>
                      j === i ? { ...r, pages: e.target.value } : r
                    )
                  )
                }
                className={`${inputClass} max-w-[7rem] font-mono`}
              />
            </div>
            <label className="flex items-center gap-2 mt-3 text-sm font-semibold">
              <input
                type="radio"
                name="reading-now"
                checked={b.reading}
                onChange={() =>
                  setRows((prev) =>
                    prev.map((r, j) => ({ ...r, reading: j === i }))
                  )
                }
                className="w-5 h-5 accent-clover"
              />
              {copy.reading.reading}
            </label>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() =>
          setRows((prev) => [
            ...prev,
            { title: "", author: "", pages: "", reading: false },
          ])
        }
        className={`${ghostButton} mt-4`}
      >
        <Plus className="w-4 h-4 mr-1.5" aria-hidden />
        {copy.reading.addBook}
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
