import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getRepo, makeDevSession, DEV_COOKIE } from "@/lib/auth";
import { isSupabaseConfigured, supabaseServer, supabaseAdmin } from "@/lib/supabase";
import { signupSchema } from "@/lib/schemas";
import { fail, ok, parseBody } from "@/lib/api";
import { isValidIANA } from "@/lib/dates";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = parseBody(signupSchema, body);
  if (!parsed.ok) return parsed.res;
  const { email, password, displayName, timezone, defaultCurrency } = parsed.data;

  if (isSupabaseConfigured()) {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) return fail("validation", error.message, { status: 400 });
    const user = data.user;
    if (!user) return fail("provider", "Signup failed.", { status: 500 });
    // Enrich the trigger-created profile with prefs.
    try {
      const admin = supabaseAdmin();
      await admin.from("profiles").update({
        timezone: timezone && isValidIANA(timezone) ? timezone : "UTC",
        default_currency: defaultCurrency ?? "EGP",
      }).eq("user_id", user.id);
    } catch { /* non-fatal */ }
    return ok({ userId: user.id, email: user.email });
  }

  // Local dev backend.
  const repo = getRepo();
  const existing = await repo.getProfileByEmail(email);
  if (existing) return fail("conflict", "An account with this email already exists.", { status: 409 });
  const profile = await repo.createProfile({
    userId: randomUUID(),
    email,
    displayName,
    timezone: timezone && isValidIANA(timezone) ? timezone : "UTC",
    defaultCurrency: defaultCurrency ?? "EGP",
    createdAt: new Date().toISOString(),
    passwordHash: password, // hashed inside the repo; never stored raw
  });
  const store = await cookies();
  store.set(DEV_COOKIE, makeDevSession(profile.userId), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return ok({ userId: profile.userId, email: profile.email });
}
