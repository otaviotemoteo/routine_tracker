import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifyAuthCookieValue } from "@/lib/auth";

// Protects everything except /login and static assets. Pages redirect to
// /login; API routes get a 401 JSON body instead (fetch callers can't follow
// a redirect to an HTML page meaningfully).
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = await verifyAuthCookieValue(
    request.cookies.get(AUTH_COOKIE)?.value,
    process.env.AUTH_SECRET ?? ""
  );

  if (pathname === "/login") {
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
