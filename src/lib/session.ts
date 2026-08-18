import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { AUTH_COOKIE } from "@/lib/auth";
import { resolveSessionUserId } from "@/lib/session-resolve";
import type { UserId } from "@/db/scope";

// Attach the integer id to whatever error this request might produce, and
// nothing else. In this app the handle IS a person's name and also their
// login, so it is the last thing that should travel to a third party; the id
// is enough to tell two accounts apart in a report, which is all it is for.
// A no-op when no DSN is configured.
function identify(userId: number): void {
  Sentry.setUser({ id: String(userId) });
}

// Next only allows a cookie write from a Server Action or a Route Handler —
// most of requireUserId/getUserId's ~37 call sites are plain page renders,
// where the cookie store is read-only and .delete() throws. Clearing the
// stale cookie where that's legal is a courtesy, not the fix: the existence
// check inside resolveSessionUserId and the redirect/null below are what
// stop the crash either way, so a failure here is swallowed rather than left
// to break a page render that was never the thing at fault.
function clearStaleCookie(store: Awaited<ReturnType<typeof cookies>>): void {
  try {
    store.delete(AUTH_COOKIE);
  } catch {
    // Read-only context (a page render) — nothing to do here; the redirect
    // or null below still ends the stale session.
  }
}

// The one place a page or action asks "who is this?". The middleware has
// already rejected unsigned requests, so reaching here without a valid
// session means either the cookie expired mid-visit or the account behind it
// is gone (see resolveSessionUserId, src/lib/session-resolve.ts) — either
// way, send them back to sign in.
//
// These two functions are the ONLY minters of a UserId in application code
// (src/db/scope.ts explains why that matters): the value they return has been
// read out of a signature this process verified AND confirmed against a live
// row, which is exactly the claim the brand encodes. Everything downstream
// demands the branded type, so a query can no longer be handed an id that
// came from a URL — or from an account that no longer exists.
export async function requireUserId(): Promise<UserId> {
  const store = await cookies();
  const userId = await resolveSessionUserId(store.get(AUTH_COOKIE)?.value);
  if (userId === null) {
    clearStaleCookie(store);
    redirect("/login");
  }
  identify(userId);
  return userId;
}

// For API routes, which answer with a 401 rather than a redirect.
export async function getUserId(): Promise<UserId | null> {
  const store = await cookies();
  const userId = await resolveSessionUserId(store.get(AUTH_COOKIE)?.value);
  if (userId === null) {
    clearStaleCookie(store);
    return null;
  }
  identify(userId);
  return userId;
}
