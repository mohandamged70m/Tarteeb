import { NextRequest } from "next/server";
import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok, parseBody } from "@/lib/api";
import { orderPatchSchema } from "@/lib/schemas";
import { ORDER_TRANSITIONS } from "@/lib/types";

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
  const order = await repo.getOrder(s.userId, id);
  if (!order) return fail("not_found", "Order not found.", { status: 404 });
  const [tasks, activity, clients] = await Promise.all([
    repo.listTasks(s.userId, id),
    repo.listActivity(s.userId, id),
    repo.listClients(s.userId),
  ]);
  const client = order.clientId ? clients.find((c) => c.id === order.clientId) ?? null : null;
  return ok({ order, tasks, activity, client });
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
  const parsed = parseBody(orderPatchSchema, body);
  if (!parsed.ok) return parsed.res;
  const { id } = await params;
  const repo = getRepo();
  const order = await repo.getOrder(s.userId, id);
  if (!order) return fail("not_found", "Order not found.", { status: 404 });
  if (parsed.data.status && parsed.data.status !== order.status) {
    const allowed = ORDER_TRANSITIONS[order.status];
    if (!allowed.includes(parsed.data.status)) {
      return fail("conflict", `Cannot move order from ${order.status} to ${parsed.data.status}.`, { status: 422 });
    }
  }
  if (parsed.data.clientId) {
    const client = await repo.getClient(s.userId, parsed.data.clientId);
    if (!client) return fail("forbidden", "Client does not belong to this account.", { status: 403 });
  }
  const updated = await repo.updateOrder(s.userId, id, parsed.data);
  return ok({ order: updated });
}
