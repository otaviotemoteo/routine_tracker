"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import {
  fieldBase,
  ghostButton,
  inputClass,
  OnboardingFooter,
  StepTitle,
} from "./OnboardingChrome";
import { ListCard } from "./ListCard";
import { PaceInfo } from "@/components/PaceInfo";
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
  // Days left in the year, computed server-side (São Paulo timezone) so the
  // pace note here matches the one on Overview.
  daysLeft: number;
  year: number;
  requireDirtyToSave?: boolean;
  titleBackHref?: string;
}

const emptyBook = (reading: boolean): BookDraft => ({
  title: "",
  author: "",
  pages: "",
  currentPage: "",
  reading,
});
const defaultBooks = (): BookDraft[] => [emptyBook(true)];

export function ReadingStep({
  action,
  next,
  backHref,
  skipHref,
  submitLabel,
  copy,
  initialGoal,
  initialBooks,
  daysLeft,
  year,
  requireDirtyToSave,
  titleBackHref,
}: ReadingStepProps) {
  const [goal, setGoal] = useState(initialGoal);
  const [rows, setRows] = useState<BookDraft[]>(
    initialBooks.length ? initialBooks : defaultBooks()
  );
  // Nothing opens on arrival when there is something to read: the step is a
  // record until you ask to change it.
  const [openIndex, setOpenIndex] = useState<number | null>(
    initialBooks.length ? null : 0
  );
  const [editIndex, setEditIndex] = useState<number | null>(
    initialBooks.length ? null : 0
  );
  const [initialSnapshot] = useState(() =>
    JSON.stringify({
      goal: initialGoal,
      rows: initialBooks.length ? initialBooks : defaultBooks(),
    })
  );
  const dirty = JSON.stringify({ goal, rows }) !== initialSnapshot;

  const goalRef = useRef<HTMLInputElement>(null);

  const filled = rows.filter((b) => b.title.trim() && Number(b.pages) > 0);
  const goalNum = Number(goal);
  const hasGoal = Number.isFinite(goalNum) && goalNum > 0;
  const missing = hasGoal ? Math.max(0, goalNum - filled.length) : 0;
  const atGoal = hasGoal && filled.length >= goalNum;

  // Same math as the Overview note: pages left in the current book plus every
  // page of the ones after it, spread over the days left in the year.
  const remainingPages = filled.reduce((sum, b) => {
    const total = Number(b.pages) || 0;
    const read = b.reading ? Number(b.currentPage) || 0 : 0;
    return sum + Math.max(0, total - read);
  }, 0);
  const pagesPerDay =
    remainingPages > 0 ? Math.ceil(remainingPages / Math.max(1, daysLeft)) : 0;

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

  function addBook() {
    setRows((prev) => {
      setOpenIndex(prev.length);
      return [...prev, emptyBook(prev.length === 0)];
    });
  }

  function focusGoal() {
    goalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    goalRef.current?.focus();
  }

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="data" value={serialized} />
      <StepTitle backHref={titleBackHref} backLabel={copy.back}>
        {copy.reading.title}
      </StepTitle>
      <p className="mt-2 opacity-75">{copy.reading.lead}</p>

      {pagesPerDay > 0 && (
        <div className="mt-3 text-sm bg-straw/20 border-2 border-forest rounded-card px-4 py-2.5 flex items-center gap-3">
          <p className="flex-1">
            {format(copy.reading.paceNote, { pages: pagesPerDay, year })}
          </p>
          <PaceInfo copy={copy.reading} />
        </div>
      )}

      <label
        htmlFor="targetBooks"
        className="block mt-6 mb-1.5 font-semibold text-sm"
      >
        {copy.reading.goal}
      </label>
      <input
        id="targetBooks"
        ref={goalRef}
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
        {hasGoal && (
          <p className="text-sm font-mono opacity-70">
            {format(copy.reading.booksCount, {
              added: filled.length,
              goal: goalNum,
            })}
          </p>
        )}
      </div>

      <ul className="flex flex-col gap-3 list-none">
        {rows.map((b, i) => (
          <li key={b.id ?? `new-${i}`}>
            <ListCard
              title={`${i + 1}. ${b.title || copy.reading.bookTitle}`}
              detail={[b.author, b.pages && `${b.pages} p`].filter(Boolean).join(" · ")}
              open={openIndex === i}
              onToggle={() => {
                setOpenIndex(openIndex === i ? null : i);
                setEditIndex(null);
              }}
              toggleLabel={copy.workout.viewDay}
              editing={editIndex === i}
              onEdit={() => setEditIndex(i)}
              editLabel={copy.config.edit}
              read={(
                <dl className="text-sm flex flex-col gap-1">
                  {b.author && (
                    <div className="flex gap-2">
                      <dt className="opacity-60">{copy.reading.author}</dt>
                      <dd className="font-medium">{b.author}</dd>
                    </div>
                  )}
                  {b.pages ? (
                    <div className="flex gap-2">
                      <dt className="opacity-60">{copy.reading.pages}</dt>
                      <dd className="font-mono">{b.pages}</dd>
                    </div>
                  ) : null}
                </dl>
              )}
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
                    onClick={() => {
                      setRows((prev) => prev.filter((_, j) => j !== i));
                      setOpenIndex(null);
                      setEditIndex(null);
                    }}
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

              {/* "Reading now" and its page belong together on one line. */}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm font-semibold min-h-[44px]">
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
                {b.reading && (
                  <input
                    type="number"
                    min={0}
                    max={Number(b.pages) || undefined}
                    inputMode="numeric"
                    placeholder={copy.reading.currentPage}
                    aria-label={copy.reading.currentPage}
                    value={b.currentPage}
                    onChange={(e) => update(i, { currentPage: e.target.value })}
                    className={`${fieldBase} w-32 font-mono`}
                  />
                )}
              </div>
            </ListCard>
          </li>
        ))}
      </ul>

      {missing > 0 && (
        <p className="text-sm opacity-75 mt-3">
          {format(copy.reading.booksRemaining, { n: missing })}
        </p>
      )}

      {/* At the goal there's nothing more to add — raising it is the way on. */}
      {atGoal ? (
        <p className="text-sm mt-4">
          <span className="opacity-75">{copy.reading.goalReachedPre} </span>
          <button
            type="button"
            onClick={focusGoal}
            className="font-semibold underline"
          >
            {format(copy.reading.goalReachedLink, { goal: goalNum })}
          </button>
        </p>
      ) : (
        <button type="button" onClick={addBook} className={`${ghostButton} mt-4`}>
          <Plus className="w-4 h-4 mr-1.5" aria-hidden />
          {copy.reading.addBook}
        </button>
      )}

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
