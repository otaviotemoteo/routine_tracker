import * as Sentry from "@sentry/nextjs";

// Next.js loads this once per server runtime, before anything else. It is the
// only place the two server-side Sentry configs are wired in.
//
// The imports are dynamic and inside the branch on purpose: the edge bundle
// must not pull in the Node SDK, and vice versa.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Server Components and route handlers throw inside React's rendering, where
// an uncaught error never reaches a global handler. This hook is what makes
// those visible; without it the server-side half of the app reports nothing.
export const onRequestError = Sentry.captureRequestError;
