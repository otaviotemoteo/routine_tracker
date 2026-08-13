"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { COPY, readLangCookieClient } from "@/lib/i18n";

// The last resort: an error in the root layout itself, where error.tsx cannot
// help because the layout that would wrap it is the thing that broke.
//
// It replaces <html> and <body>, so it can use none of the app's chrome and
// none of its fonts — the styles below are inline for that reason. Reaching
// this screen means something is badly wrong, and the one job left is to
// report it and offer a way out that does not depend on the router.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const copy = COPY[readLangCookieClient()].errorPage;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#F7F3E8",
          color: "#17281C",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>{copy.title}</h1>
          <p style={{ marginTop: "0.5rem", opacity: 0.75 }}>{copy.text}</p>
          {/* A full reload rather than reset(): whatever broke is above the
              router, so asking the router to try again is asking the broken
              thing to fix itself. A plain <a> for the same reason — <Link />
              is client-side navigation, which is the machinery that failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "inline-block",
              marginTop: "1.5rem",
              padding: "0.75rem 1.75rem",
              borderRadius: "999px",
              border: "2px solid #17281C",
              background: "#3D9B4F",
              color: "#fff",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {copy.retry}
          </a>
        </main>
      </body>
    </html>
  );
}
