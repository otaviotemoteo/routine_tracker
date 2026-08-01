import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, readAuthCookieValue } from "@/lib/auth";

// Anyone can reach these; everything else needs a signed session.
const PUBLIC_PATHS = new Set(["/login", "/signup"]);

// Protects everything except the public paths and static assets. Pages
// redirect to /login; API routes get a 401 JSON body instead (fetch callers
// can't follow a redirect to an HTML page meaningfully).
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed =
    (await readAuthCookieValue(
      request.cookies.get(AUTH_COOKIE)?.value,
      process.env.AUTH_SECRET ?? ""
    )) !== null;

  if (PUBLIC_PATHS.has(pathname)) {
    return authed
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (!authed) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals and any file with an extension (assets).
  matcher: ["/((?!_next/static|_next/image|.*\\.\\w+$).*)"],
};
