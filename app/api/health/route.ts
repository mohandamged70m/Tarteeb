import { ok, fail } from "@/lib/api";
import { productionConfigErrors } from "@/lib/env";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export async function GET() {
  if (process.env.NODE_ENV === "production" && productionConfigErrors().length) {
    return fail("configuration", "Service unavailable.", { status: 503 });
  }
  try {
    if (isSupabaseConfigured()) {
      const { error } = await supabaseAdmin().from("profiles").select("user_id").limit(1);
      if (error) throw new Error("database unavailable");
    }
    return ok({ status: "ok" });
  } catch { return fail("provider", "Service unavailable.", { status: 503 }); }
}
