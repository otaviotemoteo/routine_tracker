import * as Sentry from "@sentry/nextjs";
import { SHARED_OPTIONS } from "@/lib/sentry-scrub";

// Node runtime. Loaded by src/instrumentation.ts.
//
// Everything about what is and is not sent lives in src/lib/sentry-scrub.ts,
// shared by all three runtimes so the rule cannot drift between them.
Sentry.init(SHARED_OPTIONS);
