import { NextRequest } from "next/server";
import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok, parseBody } from "@/lib/api";
import { orderCreateSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const q = req.nextUrl.searchParams;
  const status = q.get("status") ?? "all";
  if (!["all", "draft", "ready", "in_progress", "delivered", "completed", "cancelled"].includes(status)) {
    return fail("validation", "Invalid status filter.", { status: 400 });
  }
  const sort = q.get("sort") === "due" ? "due" : "created";
  const orders = await getRepo().listOrders(s.userId, {
    search: q.get("search") ?? undefined,
    status: status as "all",
    clientId: q.get("clientId") ?? undefined,
    sort,
  });
  return ok({ orders });
}

export async function POST(req: NextRequest) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseBody(orderCreateSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;
  const repo = getRepo();
  if (d.clientId) {
    const client = await repo.getClient(s.userId, d.clientId);
    if (!client) return fail("forbidden", "Client does not belong to this account.", { status: 403 });
  }
  const profile = await repo.getProfile(s.userId);
  const order = await repo.createOrderManual(s.userId, {
    clientId: d.clientId,
    title: d.title,
    description: d.description,
    deliverables: d.deliverables,
    requirements: d.requirements,
    deadlineDate: d.deadlineDate,
    deadlineText: d.deadlineText,
    timezone: profile?.timezone ?? "UTC",
    budgetAmount: d.budgetAmount,
    budgetCurrency: d.budgetCurrency,
    tasks: d.tasks,
  });
  return ok({ order }, 201);
}
