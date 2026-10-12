import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getRepo, makeDevSession, DEV_COOKIE } from "@/lib/auth";
import { isSupabaseConfigured, supabaseServer } from "@/lib/supabase";
import { signinSchema } from "@/lib/schemas";
import { fail, ok, parseBody } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = parseBody(signinSchema, body);
  if (!parsed.ok) return parsed.res;
  const { email, password } = parsed.data;

  if (isSupabaseConfigured()) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return fail("unauthorized", "Invalid email or password.", { status: 401 });
    return ok({ ok: true });
  }

  const repo = getRepo();
  const profile = await repo.getProfileByEmail(email);
  if (!profile) return fail("unauthorized", "Invalid email or password.", { status: 401 });
  const valid = await repo.verifyPassword(profile.userId, password);
  if (!valid) return fail("unauthorized", "Invalid email or password.", { status: 401 });
  const store = await cookies();
  store.set(DEV_COOKIE, makeDevSession(profile.userId), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return ok({ ok: true });
}
