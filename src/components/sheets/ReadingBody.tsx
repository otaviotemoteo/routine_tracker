"use client";

import { useEffect, useState } from "react";
import { format, locale } from "@/lib/i18n";
import { asRecord, fieldClass, labelClass, type SheetBodyProps } from "./types";

export function ReadingBody({
  context,
  initial,
  copy,
  lang,
  onChange,
}: SheetBodyProps) {
  const book = context.book;
  const initialRecord = asRecord(initial);
  const [endedOnPage, setEndedOnPage] = useState<string>(
    typeof initialRecord?.ended_on_page === "number"
      ? String(initialRecord.ended_on_page)
      : book
        ? String(book.currentPage)
        : ""
  );

  const ended = Number(endedOnPage);
  const pagesRead = book ? Math.max(0, ended - book.currentPage) : 0;

  useEffect(() => {
    if (!book || !Number.isFinite(ended) || ended < 0) {
      onChange(null);
      return;
    }
    onChange({
      book_id: book.id,
      ended_on_page: ended,
      pages_read: pagesRead,
    });
  }, [book, ended, pagesRead, onChange]);

  if (!book) {
    return <p className="opacity-75">{copy.reading.noBook}</p>;
  }

  // "Keep this up and you finish on …" — days needed at today's rate, from
  // today. Formatted in the viewer's language; UTC-noon keeps the day stable.
  const pagesLeft = Math.max(0, book.totalPages - ended);
  let projection: string | null = null;
  if (pagesRead > 0) {
    if (pagesLeft === 0) {
      projection = copy.reading.finishToday;
    } else {
      const days = Math.ceil(pagesLeft / pagesRead);
      const finish = new Date();
      finish.setUTCHours(12, 0, 0, 0);
      finish.setUTCDate(finish.getUTCDate() + days);
      projection = format(copy.reading.finishEstimate, {
        date: new Intl.DateTimeFormat(locale(lang), {
          timeZone: "UTC",
          day: "numeric",
          month: "short",
        }).format(finish),
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-semibold">{book.title}</p>
      <div>
        <label htmlFor="ended-page" className={labelClass}>
          {copy.reading.endedOnPage}
        </label>
        <div className="flex items-center gap-2">
          <input
            id="ended-page"
            type="number"
            min={0}
            max={book.totalPages}
            inputMode="numeric"
            value={endedOnPage}
            onChange={(e) => setEndedOnPage(e.target.value)}
            className={`${fieldClass} font-mono max-w-[7rem]`}
          />
          <span className="opacity-75 text-sm">
            {copy.reading.of} {book.totalPages}
          </span>
        </div>
      </div>
      <p className="text-sm font-semibold">
        {copy.reading.pagesRead}:{" "}
        <span className="font-mono text-clover">+{pagesRead}</span>
      </p>

      {/* What today's pace implies for this book — recomputed as you type. */}
      {projection && (
        <p className="text-sm bg-mint border-2 border-forest rounded-card px-3 py-2">
          {projection}
        </p>
      )}
    </div>
  );
}
