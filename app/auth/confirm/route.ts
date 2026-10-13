import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseServer } from "@/lib/supabase";

/** Token-hash email template creates a server-side session without an open redirect. */
export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type");
  const origin = process.env.APP_URL ?? req.nextUrl.origin;
  if (isSupabaseConfigured() && tokenHash && (type === "email" || type === "signup")) {
    try {
      const sb = await supabaseServer();
      const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(new URL("/", origin));
    } catch { /* Render a safe message on the login page. */ }
  }
  return NextResponse.redirect(new URL("/login?confirmation=failed", origin));
}
