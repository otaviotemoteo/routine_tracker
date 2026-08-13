"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { CircleAlert, RotateCcw } from "lucide-react";
import { COPY, readLangCookieClient } from "@/lib/i18n";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Route-level error boundary: shown when a page's server fetch throws (e.g.
// the database is unreachable). Error boundaries are always Client
// Components, so the language comes from document.cookie, not cookies().
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  // React swallows the error once a boundary has caught it, so without this
  // the screen below would be the only evidence it ever happened. What the
  // report is allowed to carry is decided in src/lib/sentry-scrub.ts.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const copy = COPY[readLangCookieClient()].errorPage;

  return (
    <main className="max-w-3xl mx-auto px-6 pt-20 pb-24">
      <div className="bg-white border-2 border-forest rounded-card shadow-hard p-6 sm:p-8 max-w-md">
        <CircleAlert aria-hidden className="w-8 h-8 text-straw" />
        <h1 className="display-title text-2xl mt-3">{copy.title}</h1>
        <p className="mt-2 opacity-75">{copy.text}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 min-h-[48px] inline-flex items-center justify-center gap-2 px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
        >
          <RotateCcw aria-hidden className="w-5 h-5" />
          {copy.retry}
        </button>
      </div>
    </main>
  );
}
