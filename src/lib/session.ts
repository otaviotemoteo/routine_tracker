import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, readAuthCookieValue } from "@/lib/auth";

// The one place a page or action asks "who is this?". The middleware has
// already rejected unsigned requests, so reaching here without a valid cookie
// means the session expired mid-visit — send them back to sign in.
export async function requireUserId(): Promise<number> {
  const userId = await readAuthCookieValue(
    (await cookies()).get(AUTH_COOKIE)?.value,
    process.env.AUTH_SECRET ?? ""
  );
  if (userId === null) redirect("/login");
  return userId;
}

// For API routes, which answer with a 401 rather than a redirect.
export async function getUserId(): Promise<number | null> {
  return readAuthCookieValue(
    (await cookies()).get(AUTH_COOKIE)?.value,
    process.env.AUTH_SECRET ?? ""
  );
}
