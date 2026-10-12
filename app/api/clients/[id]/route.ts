import { NextRequest } from "next/server";
import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok, parseBody } from "@/lib/api";
import { clientPatchSchema } from "@/lib/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const { id } = await params;
  const repo = getRepo();
  const client = await repo.getClient(s.userId, id);
  if (!client) return fail("not_found", "Client not found.", { status: 404 });
  const orders = await repo.ordersForClient(s.userId, id);
  return ok({ client, orders });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseBody(clientPatchSchema, body);
  if (!parsed.ok) return parsed.res;
  const { id } = await params;
  const client = await getRepo().updateClient(s.userId, id, parsed.data);
  if (!client) return fail("not_found", "Client not found.", { status: 404 });
  return ok({ client });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const { id } = await params;
  const deleted = await getRepo().deleteClient(s.userId, id);
  if (!deleted) {
    return fail("conflict", "Client not found or has orders. Reassign orders first.", { status: 409 });
  }
  return ok({ ok: true });
}
