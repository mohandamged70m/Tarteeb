import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route protection. Supabase session cookies are HttpOnly and unreadable here,
 * so when Supabase is configured we let the request through and pages/layouts
 * verify via getSession() (server-side). The dev cookie is HMAC-signed; we do
 * a cheap shape check here and verify properly server-side.
 */
const PUBLIC = ["/login", "/signup"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.next(); // verified server-side in pages
  }
  const session = req.cookies.get("tarteeb_dev_session")?.value;
  if (!session || session.lastIndexOf(".") < 1) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
