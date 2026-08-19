import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession, verifyApiSecret } from "@/lib/auth";

/** Paths that never require authentication. */
const PUBLIC_PREFIXES = ["/", "/api/lookup", "/admin/login", "/api/auth/"];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/_next")) return true;
  return PUBLIC_PREFIXES.some((p) => p !== "/" && pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  if (verifyApiSecret(request.headers.get("x-api-secret"))) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value ?? "";
  const authSecret = process.env.AUTH_SECRET ?? "";

  if (cookieValue && authSecret) {
    const valid = await verifySession(cookieValue, authSecret);
    if (valid) return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
