import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { resolveSessionUserId } from "@/lib/session-resolve";

// Anyone can reach these; everything else needs a signed session.
const PUBLIC_PATHS = new Set(["/login", "/signup"]);

// A cookie whose signature checks out but whose account is gone must not
// survive this response — session.ts's own clearStaleCookie is only a
// courtesy (most of its callers are page renders, where cookies() is
// read-only and .delete() throws and is swallowed). Middleware is the one
// place a delete is guaranteed to stick, and the one place whose decision
// governs both directions of the redirect: skipping this is exactly what
// produced a real, live ERR_TOO_MANY_REDIRECTS loop for a stale-cookie
// browser — middleware kept calling the cookie valid on signature alone,
// bounced /login back to /, whose page-level check correctly found the
// account gone and bounced back to /login, forever.
function clearAuthCookie(request: NextRequest, response: NextResponse): void {
  if (request.cookies.get(AUTH_COOKIE)) {
    response.cookies.delete(AUTH_COOKIE);
  }
}

// Protects everything except the public paths and static assets. Pages
// redirect to /login; API routes get a 401 JSON body instead (fetch callers
// can't follow a redirect to an HTML page meaningfully).
//
// authed means more than "signed" — resolveSessionUserId also confirms the
// account still exists (one DB round trip, over the same fetch-based driver
// the rest of the app already uses, so it's fine at edge). A cookie that
// fails either check is cleared right here, not just treated as absent.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userId = await resolveSessionUserId(request.cookies.get(AUTH_COOKIE)?.value);
  const authed = userId !== null;

  if (PUBLIC_PATHS.has(pathname)) {
    if (authed) return NextResponse.redirect(new URL("/", request.url));
    const response = NextResponse.next();
    clearAuthCookie(request, response);
    return response;
  }

  if (!authed) {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));
    clearAuthCookie(request, response);
    return response;
  }

  // A layout can't see the request's pathname or search params — only a page
  // can. The (app) gate needs the pathname to make one narrow exemption (see
  // its own comment), so it rides in on a header, the standard way to hand a
  // layout something only middleware can see.
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  // Skip Next internals and any file with an extension (assets).
  matcher: ["/((?!_next/static|_next/image|.*\\.\\w+$).*)"],
};
