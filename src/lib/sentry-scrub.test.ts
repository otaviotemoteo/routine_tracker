import { describe, expect, test } from "bun:test";
import type { ErrorEvent, EventHint } from "@sentry/nextjs";
import { scrubEvent, SHARED_OPTIONS } from "./sentry-scrub";

// What may leave this machine — asserted rather than reviewed.
//
// The scrubbing rules are the kind of thing that looks obviously right in a
// code review and then quietly stops being true: someone adds a field, renames
// a key, or "simplifies" the dataCollection block. This suite is here so that
// a regression is a red test rather than a paragraph of somebody's marriage
// showing up in a third-party dashboard six months from now.
//
// It needs no network and no DSN, so it runs everywhere the rest of the suite
// does.

const hint = {} as EventHint;

function evt(partial: Partial<ErrorEvent>): ErrorEvent {
  return { type: undefined, ...partial } as ErrorEvent;
}

describe("scrubEvent", () => {
  test("reduces the user to an integer id", () => {
    const out = scrubEvent(
      evt({
        user: {
          id: "7",
          username: "sofia",
          email: "sofia@example.com",
          ip_address: "203.0.113.9",
        },
      }),
      hint
    );
    // The handle IS a person's name in this app, and also their login.
    expect(out.user).toEqual({ id: "7" });
  });

  test("drops the whole request envelope", () => {
    const out = scrubEvent(
      evt({
        request: {
          url: "https://app/assessment/directions",
          // A bearer credential: whoever holds it is signed in as that person.
          cookies: { pt_auth: "7.1234.deadbeef" },
          headers: { cookie: "pt_auth=7.1234.deadbeef", authorization: "Bearer x" },
          // A server action payload — the reflection text, verbatim.
          data: { rawReflection: "My father has been distant since…" },
          query_string: "domain=family",
        },
      }),
      hint
    );

    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.headers).toBeUndefined();
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.query_string).toBe("[redacted]");
    // The URL survives on purpose: it is how you find the route that broke.
    expect(out.request?.url).toBe("https://app/assessment/directions");
  });

  test("redacts sensitive keys at depth, in any casing", () => {
    const out = scrubEvent(
      evt({
        extra: {
          harmless: "keep me",
          narrative: "I want to move toward…",
          raw_reflection: "long private text",
          nested: {
            deeper: { assessmentRatings: [9, 9, 3], promptText: "system…" },
          },
        },
      }),
      hint
    );

    const extra = out.extra as Record<string, unknown>;
    expect(extra.harmless).toBe("keep me");
    expect(extra.narrative).toBe("[redacted]");
    expect(extra.raw_reflection).toBe("[redacted]");

    const deeper = (extra.nested as Record<string, Record<string, unknown>>)
      .deeper;
    expect(deeper.assessmentRatings).toBe("[redacted]");
    expect(deeper.promptText).toBe("[redacted]");
  });

  test("scrubs breadcrumb data without dropping the trail", () => {
    const out = scrubEvent(
      evt({
        breadcrumbs: [
          {
            category: "ai",
            message: "habit_suggester: google error",
            data: { provider: "google", prompt: "their directions…" },
          },
        ],
      }),
      hint
    );

    // The breadcrumb itself is the useful part — which provider failed, in
    // what order. Only its payload is touched.
    expect(out.breadcrumbs).toHaveLength(1);
    expect(out.breadcrumbs![0].message).toBe("habit_suggester: google error");
    const data = out.breadcrumbs![0].data as Record<string, unknown>;
    expect(data.provider).toBe("google");
    expect(data.prompt).toBe("[redacted]");
  });

  test("survives a cyclic object rather than throwing inside the reporter", () => {
    const cyclic: Record<string, unknown> = { name: "loop" };
    cyclic.self = cyclic;
    // A crash in beforeSend would turn one error into an outage.
    expect(() => scrubEvent(evt({ extra: { cyclic } }), hint)).not.toThrow();
  });
});

describe("SHARED_OPTIONS", () => {
  test("collects nothing automatically", () => {
    // Guards the migration off the deprecated `sendDefaultPii`. Every category
    // must stay explicitly denied: an omitted one silently falls back to the
    // SDK's own default, and most of those defaults are `true`.
    expect(SHARED_OPTIONS.dataCollection).toEqual({
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      userInfo: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
    });
  });

  test("stays errors-only", () => {
    // Tracing and replay are off by decision, not by accident — see the AI
    // layer's scope note in docs/ARCHITECTURE.md.
    expect(SHARED_OPTIONS.tracesSampleRate).toBe(0);
    expect("replaysSessionSampleRate" in SHARED_OPTIONS).toBe(false);
    expect("enableLogs" in SHARED_OPTIONS).toBe(false);
  });

  test("is inert without a DSN", () => {
    // What makes a credential-free machine build and run unchanged.
    expect(SHARED_OPTIONS.enabled).toBe(Boolean(SHARED_OPTIONS.dsn));
  });
});
