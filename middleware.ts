import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { productionConfigErrors } from "@/lib/env";
import { consumeRateLimit } from "@/lib/rate-limit";

const PUBLIC = ["/login", "/signup", "/auth/confirm"];
const AUTH = ["/api/auth/signin", "/api/auth/signup"];
const AI = ["/api/intake/message", "/api/intake/answer", "/api/ai/test"];
const error = (status: number, code: string, message: string, retryAfter?: number) =>
  NextResponse.json({ error: { code, message, retryable: status >= 500 || status === 429 } }, {
    status, headers: { "Cache-Control": "private, no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) },
  });

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // Only assets bypass authentication/configuration checks.
  if (!path.startsWith("/api/") && (/\.[a-z0-9]+$/i.test(path) || path.startsWith("/_next/") || path === "/icon" || path.startsWith("/apple-icon"))) {
    return NextResponse.next();
  }
  if (process.env.NODE_ENV === "production" && productionConfigErrors().length) {
    return error(503, "configuration", "The app is not configured for production yet.");
  }
  if (path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    // Next.js may normalize a loopback hostname to localhost internally.
    // The browser's Host header preserves the origin it actually visited.
    const requestOrigin = `${req.nextUrl.protocol}//${req.headers.get("host") ?? req.nextUrl.host}`;
    if (req.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== requestOrigin)) {
      return error(403, "origin", "This request must come from this app.");
    }
    if (Number(req.headers.get("content-length") ?? 0) > 131072) {
      return error(413, "oversized", "Request body is too large.");
    }
  }
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  let response = NextResponse.next({ request: req });
  let userId: string | undefined;
  try {
    if (AUTH.includes(path) && req.method === "POST") {
      // Vercel overwrites this header. Other hosts must explicitly trust their proxy.
      const ip = process.env.VERCEL || process.env.TRUST_PROXY === "1"
        ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
        : "unknown";
      const limited = await consumeRateLimit(`auth:${ip}`, 10, 60);
      if (!limited.allowed) return error(429, "rate_limited", "Too many attempts. Wait a minute and retry.", limited.retryAfter);
    }
    if (configured) {
      const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
            toSet.forEach(({ name, value }) => req.cookies.set(name, value));
            response = NextResponse.next({ request: req });
            toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      });
      const { data, error: authError } = await sb.auth.getUser();
      if (!authError) userId = data.user?.id;
    }
    if (userId && AI.includes(path) && req.method === "POST") {
      for (const [bucket, limit, seconds] of [["minute", 10, 60], ["day", 100, 86400]] as const) {
        const limited = await consumeRateLimit(`ai:${bucket}:${userId}`, limit, seconds);
        if (!limited.allowed) {
          const denied = error(429, "ai_rate_limited", "Assistant limit reached. Try again later.", limited.retryAfter);
          response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
          return denied;
        }
      }
    }
  } catch {
    return error(503, "provider", "The authentication service is unavailable. Please retry.");
  }
  if (!path.startsWith("/api/") && !PUBLIC.includes(path)) {
    const devCookie = req.cookies.get("tarteeb_dev_session")?.value;
    if (configured ? !userId : !devCookie || devCookie.lastIndexOf(".") < 1) {
      const redirect = NextResponse.redirect(new URL("/login", req.url));
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
