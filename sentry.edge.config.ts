import * as Sentry from "@sentry/nextjs";
import { SHARED_OPTIONS } from "@/lib/sentry-scrub";

// Edge runtime — which here means the auth middleware, and only the auth
// middleware. It runs on every request, so an error in it is the difference
// between "the app is up" and "nobody can sign in", and it is the one place
// worth being told about immediately.
Sentry.init(SHARED_OPTIONS);
