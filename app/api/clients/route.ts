import { NextRequest } from "next/server";
import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok, parseBody } from "@/lib/api";
import { clientCreateSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const clients = await getRepo().listClients(s.userId, search);
  return ok({ clients });
}

export async function POST(req: NextRequest) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseBody(clientCreateSchema, body);
  if (!parsed.ok) return parsed.res;
  const client = await getRepo().createClient(s.userId, {
    name: parsed.data.name.trim(),
    contact: parsed.data.contact?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
  });
  return ok({ client }, 201);
}
