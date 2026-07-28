"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import {
  fieldBase,
  ghostButton,
  inputClass,
  OnboardingFooter,
} from "./OnboardingChrome";
import { format, type Copy } from "@/lib/i18n";

export interface BookDraft {
  id?: number;
  title: string;
  author: string;
  pages: string;
  currentPage: string;
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

const emptyBook = (reading: boolean): BookDraft => ({
  title: "",
  author: "",
  pages: "",
  currentPage: "",
  reading,
});

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
    initialBooks.length ? initialBooks : [emptyBook(true)]
  );

  const filled = rows.filter((b) => b.title.trim() && Number(b.pages) > 0);
  const goalNum = Number(goal);
  const missing =
    Number.isFinite(goalNum) && goalNum > 0
      ? Math.max(0, goalNum - filled.length)
      : 0;

  // Array order is the reading order (position); id is kept so the server can
  // update existing books instead of recreating them.
  const serialized = JSON.stringify(
    filled.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      pages: Number(b.pages),
      currentPage: Number(b.currentPage) || 0,
      reading: b.reading,
    }))
  );

  const update = (i: number, patch: Partial<BookDraft>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const move = (i: number, delta: number) =>
    setRows((prev) => {
      const target = i + delta;
      if (target < 0 || target >= prev.length) return prev;
      const copyRows = [...prev];
      [copyRows[i], copyRows[target]] = [copyRows[target], copyRows[i]];
      return copyRows;
    });

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

      <div className="mt-6 mb-2 flex items-baseline justify-between gap-3 flex-wrap">
        <p className="font-semibold">{copy.reading.list}</p>
        {goalNum > 0 && (
          <p className="text-sm font-mono opacity-70">
            {format(copy.reading.booksCount, {
              added: filled.length,
              goal: goalNum,
            })}
          </p>
        )}
      </div>

      <ul className="flex flex-col gap-4 list-none">
        {rows.map((b, i) => (
          <li
            key={b.id ?? `new-${i}`}
            className="bg-white border-2 border-forest rounded-card shadow-hard p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm opacity-50 shrink-0">
                {i + 1}
              </span>
              <input
                placeholder={copy.reading.bookTitle}
                aria-label={copy.reading.bookTitle}
                value={b.title}
                onChange={(e) => update(i, { title: e.target.value })}
                className={`${inputClass} min-w-0 flex-1`}
              />
              <div className="flex shrink-0">
                <button
                  type="button"
                  aria-label={copy.reading.moveUp}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="min-h-[44px] min-w-[36px] inline-flex items-center justify-center rounded-l-lg border-2 border-forest bg-white disabled:opacity-30"
                >
                  <ChevronUp className="w-4 h-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={copy.reading.moveDown}
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                  className="min-h-[44px] min-w-[36px] inline-flex items-center justify-center rounded-r-lg border-2 border-l-0 border-forest bg-white disabled:opacity-30"
                >
                  <ChevronDown className="w-4 h-4" aria-hidden />
                </button>
              </div>
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
                onChange={(e) => update(i, { author: e.target.value })}
                className={`${inputClass} min-w-0 flex-1`}
              />
              <input
                placeholder={copy.reading.pages}
                aria-label={copy.reading.pages}
                type="number"
                min={1}
                inputMode="numeric"
                value={b.pages}
                onChange={(e) => update(i, { pages: e.target.value })}
                className={`${fieldBase} w-24 shrink-0 font-mono`}
              />
            </div>

            <label className="flex items-center gap-2 mt-3 text-sm font-semibold">
              <input
                type="radio"
                name="reading-now"
                checked={b.reading}
                onChange={() =>
                  setRows((prev) => prev.map((r, j) => ({ ...r, reading: j === i })))
                }
                className="w-5 h-5 accent-clover"
              />
              {copy.reading.reading}
            </label>

            {/* Only the current book needs a page — it drives the pace math. */}
            {b.reading && (
              <div className="mt-3">
                <label
                  htmlFor={`current-page-${i}`}
                  className="block mb-1.5 font-semibold text-sm"
                >
                  {copy.reading.currentPage}
                </label>
                <input
                  id={`current-page-${i}`}
                  type="number"
                  min={0}
                  max={Number(b.pages) || undefined}
                  inputMode="numeric"
                  value={b.currentPage}
                  onChange={(e) => update(i, { currentPage: e.target.value })}
                  className={`${fieldBase} w-24 font-mono`}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {missing > 0 && (
        <p className="text-sm opacity-75 mt-3">
          {format(copy.reading.booksRemaining, { n: missing })}
        </p>
      )}

      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, emptyBook(prev.length === 0)])}
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
