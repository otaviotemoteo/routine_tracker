import type { ErrorEvent, EventHint, init } from "@sentry/nextjs";

// The SDK does not re-export its options type, but it does export `init`, so
// the argument type can be read back off it. Derived rather than pinned to
// `@sentry/react`/`@sentry/node` directly, which are transitive dependencies
// this package has no business importing.
type SentryOptions = NonNullable<Parameters<typeof init>[0]>;

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

// The DSN. `SENTRY_DSN` is the server/edge name and `NEXT_PUBLIC_SENTRY_DSN`
// the browser one; either alone is enough for this app, and the fallback means
// one variable configures all three runtimes.
const DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

// Shared options. Errors only: no tracing, no replay, no logs — that is the
// entire observability scope, and the sample rates say so here rather than
// leaving it to a setting on the dashboard.
// `satisfies` rather than a bare object literal, and that is load-bearing:
// TypeScript only excess-property-checks a literal at the point it is assigned
// to a typed target. Passing an untyped const straight to Sentry.init() skips
// that check entirely, so a misspelled `dataCollection` key — the one mistake
// in this file that silently turns collection back ON — would compile clean.
export const SHARED_OPTIONS = {
  dsn: DSN,
  // Without a DSN the SDK is inert, which is what makes local development and
  // a credential-free build machine work unchanged.
  enabled: Boolean(DSN),
  tracesSampleRate: 0,

  // WHAT THE SDK IS ALLOWED TO COLLECT ON ITS OWN.
  //
  // This replaces `sendDefaultPii: false`, which is deprecated in v10 and gone
  // in v11. The migration is not a rename and getting it wrong is expensive:
  // `sendDefaultPii: false` denied everything, whereas passing a
  // `dataCollection` object flips every category NOT named here to its own
  // permissive default — cookies, request/response headers, all four HTTP body
  // types, query params and database query data are each `true` by default.
  // So `dataCollection: {}` would be the single most damaging edit anyone
  // could make to this file, and every category is therefore listed explicitly
  // rather than left to a default.
  //
  // This is the first line of defence; `beforeSend` above is the second. The
  // two overlap on purpose.
  dataCollection: {
    // The session cookie is a bearer credential — anyone holding it is signed
    // in as that person.
    cookies: false,
    httpHeaders: { request: false, response: false },
    // Server action payloads carry the reflection someone wrote about their
    // family, verbatim.
    httpBodies: [],
    urlQueryParams: false,
    // `user.*` is set deliberately in src/lib/session.ts — the integer id and
    // nothing else. Never populated from instrumentation.
    userInfo: false,
    // Query text is already parameterised and stays; this is the bound values
    // and returned rows, which are the assessment answers themselves.
    databaseQueryData: false,
    // Locals in a stack frame include whatever was being written when it threw.
    stackFrameVariables: false,
    genAI: { inputs: false, outputs: false },
  },

  beforeSend: scrubEvent,
} satisfies SentryOptions;
