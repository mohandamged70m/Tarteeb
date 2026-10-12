import { cookies } from "next/headers";
import { DEV_COOKIE } from "@/lib/auth";
import { isSupabaseConfigured, supabaseServer } from "@/lib/supabase";
import { ok } from "@/lib/api";

export async function POST() {
  if (isSupabaseConfigured()) {
    const sb = await supabaseServer();
    await sb.auth.signOut();
  }
  const store = await cookies();
  store.delete(DEV_COOKIE);
  return ok({ ok: true });
}
