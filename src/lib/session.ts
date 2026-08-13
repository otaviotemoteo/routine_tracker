import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, readAuthCookieValue } from "@/lib/auth";
import { asUserId, type UserId } from "@/db/scope";

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
  return asUserId(userId);
}

// For API routes, which answer with a 401 rather than a redirect.
export async function getUserId(): Promise<UserId | null> {
  const userId = await readAuthCookieValue(
    (await cookies()).get(AUTH_COOKIE)?.value,
    process.env.AUTH_SECRET ?? ""
  );
  return userId === null ? null : asUserId(userId);
}
