import type { ErrorEvent, EventHint } from "@sentry/nextjs";

// What may leave this machine.
//
// One module, imported by all three Sentry configs, because a scrubbing rule
// that lives in three places is a scrubbing rule that will be right in two of
// them. It has no imports of its own beyond a type, so the client bundle can
// use it too.
//
// The reason this needs care in THIS app rather than the usual boilerplate
// amount: an error report is a snapshot of a request, and the requests here
// carry a sealed values assessment, the long reflection someone wrote about
// their family, and the prompt built out of it. An observability tool that
// quietly ships that to a third party would undo the one promise the app makes
// about that data. So the default is deny: whole categories are dropped rather
// than pattern-matched, because a pattern only catches what you thought of.

// Anything whose key looks like one of these is replaced wholesale. Matched
// case-insensitively as a substring, so `rawReflection` and `raw_reflection`
// both go.
const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "cookie",
  "authorization",
  "apikey",
  "api_key",
  "prompt",
  "narrative",
  "reflection",
  "rating",
  "assessment",
  "answers",
  "minimalaction",
  "note",
];

const REDACTED = "[redacted]";

function isSensitive(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some((needle) => lower.includes(needle));
}

// Depth-limited so a cyclic or enormous object cannot turn a crash report into
// a second outage.
function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitive(key) ? REDACTED : redact(v, depth + 1);
  }
  return out;
}

// The `beforeSend` every config uses.
export function scrubEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent {
  // ── Identity ────────────────────────────────────────────────────────────
  // The integer id and nothing else. A handle IS a person's name in this app,
  // and it is also their login, so it is the last thing that should travel.
  if (event.user) {
    event.user = event.user.id ? { id: String(event.user.id) } : {};
  }

  // ── The request ─────────────────────────────────────────────────────────
  if (event.request) {
    // The session cookie is a bearer credential: anyone holding it is signed
    // in as that person. It never leaves, in any form.
    delete event.request.cookies;
    delete event.request.headers;

    // Server action payloads live here, and those carry the reflection text
    // and the assessment answers verbatim. Dropped whole rather than filtered.
    delete event.request.data;

    // A query string is small and occasionally carries a domain slug, which is
    // enough to say which part of somebody's life an error happened in.
    if (event.request.query_string) event.request.query_string = REDACTED;
  }

  // ── Everything else the SDK collected ───────────────────────────────────
  if (event.extra) {
    event.extra = redact(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = redact(event.contexts) as NonNullable<
      ErrorEvent["contexts"]
    >;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      data: crumb.data
        ? (redact(crumb.data) as Record<string, unknown>)
        : undefined,
    }));
  }

  return event;
}

// Shared options. Errors only: no tracing, no replay, no dashboards — that is
// the entire observability scope, and the sample rates say so rather than
// leaving it to a plan setting.
export const SHARED_OPTIONS = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Without a DSN the SDK is inert, which is what makes local development and
  // the build machine work unchanged.
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  // IPs, headers and request bodies, off at the source. beforeSend is the
  // second line, not the first.
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
};
