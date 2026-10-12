import { NextRequest } from "next/server";
import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok, parseBody } from "@/lib/api";
import { settingsPatchSchema } from "@/lib/schemas";
import { isValidIANA } from "@/lib/dates";

export async function GET() {
  try {
    const s = await requireSession();
    const profile = await getRepo().getProfile(s.userId);
    if (!profile) return fail("not_found", "Profile not found.", { status: 404 });
    return ok({ profile });
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseBody(settingsPatchSchema, body);
  if (!parsed.ok) return parsed.res;
  if (parsed.data.timezone && !isValidIANA(parsed.data.timezone)) {
    return fail("validation", "Unknown timezone. Use an IANA name like Africa/Cairo.", { status: 400 });
  }
  const profile = await getRepo().updateProfile(s.userId, parsed.data);
  return ok({ profile });
}
