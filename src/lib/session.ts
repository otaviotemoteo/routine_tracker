import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { AUTH_COOKIE, readAuthCookieValue } from "@/lib/auth";
import { asUserId, type UserId } from "@/db/scope";

// Attach the integer id to whatever error this request might produce, and
// nothing else. In this app the handle IS a person's name and also their
// login, so it is the last thing that should travel to a third party; the id
// is enough to tell two accounts apart in a report, which is all it is for.
// A no-op when no DSN is configured.
function identify(userId: number): void {
  Sentry.setUser({ id: String(userId) });
}

// The one place a page or action asks "who is this?". The middleware has
// already rejected unsigned requests, so reaching here without a valid cookie
// means the session expired mid-visit — send them back to sign in.
//
// These two functions are the ONLY minters of a UserId in application code
// (src/db/scope.ts explains why that matters): the value they return has been
// read out of a signature this process verified, which is exactly the claim
// the brand encodes. Everything downstream demands the branded type, so a
// query can no longer be handed an id that came from a URL.
export async function requireUserId(): Promise<UserId> {
  const userId = await readAuthCookieValue(
    (await cookies()).get(AUTH_COOKIE)?.value,
    process.env.AUTH_SECRET ?? ""
  );
  if (userId === null) redirect("/login");
  identify(userId);
  return asUserId(userId);
}

// For API routes, which answer with a 401 rather than a redirect.
export async function getUserId(): Promise<UserId | null> {
  const userId = await readAuthCookieValue(
    (await cookies()).get(AUTH_COOKIE)?.value,
    process.env.AUTH_SECRET ?? ""
  );
  if (userId === null) return null;
  identify(userId);
  return asUserId(userId);
}
