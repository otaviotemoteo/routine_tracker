import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async redirects() {
    // v1 routes folded into the Overview toggle (v2).
    return [
      { source: "/semana", destination: "/overview?view=week", permanent: true },
      { source: "/mes", destination: "/overview?view=month", permanent: true },
    ];
  },
};

// Errors only — no tracing, no replay, no dashboards. The runtime half of that
// scope is in src/lib/sentry-scrub.ts; this is the build half.
export default withSentryConfig(nextConfig, {
  // Which project the source maps belong to. Without these the upload has
  // nowhere to go, so every production stack trace stays minified.
  org: "side-projects-otavio",
  project: "personal_tracker",
  // A build-time secret, distinct from the DSN. Its absence must not break a
  // build: the plugin skips the upload and `bun run build` still succeeds,
  // which is what lets a machine with no credentials build the app.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Quiet locally, loud in CI, where the upload either working or not is the
  // only place anyone would see it.
  silent: !process.env.CI,
  // Stack traces point at readable code, and the maps are deleted afterwards
  // so nothing readable is served from the app itself.
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  // `tunnelRoute` is deliberately NOT set. It would proxy browser reports
  // through this app's origin to dodge ad blockers, but the route it creates
  // has to be public — the middleware protects everything else — and an
  // unauthenticated proxy endpoint is a bigger thing to own than the problem
  // it solves. Server-side reporting, which is where the errors that matter
  // happen, is unaffected either way.
  //
  // The SDK's own console noise, which is not something to be told about.
  disableLogger: true,
});
