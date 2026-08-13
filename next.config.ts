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
  // Source map upload needs SENTRY_AUTH_TOKEN, and its absence must not break
  // a build. Without it the plugin skips upload and the build succeeds, which
  // is what makes `bun run build` work on a machine with no credentials.
  silent: true,
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
