import * as Sentry from "@sentry/nextjs";
import { SHARED_OPTIONS } from "@/lib/sentry-scrub";

// The browser half. Next.js loads this before any client code runs.
//
// No Session Replay, deliberately and not as an oversight. Replay records the
// DOM, and the DOM of this app is somebody's assessment answers, the paragraph
// they wrote about their marriage, and their habits. Masking would be a
// setting to get wrong once; not installing it is a decision that stays made.
Sentry.init(SHARED_OPTIONS);

// Router transitions, so a client-side navigation that throws is attributed to
// the route it was heading to rather than to the one it left.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
