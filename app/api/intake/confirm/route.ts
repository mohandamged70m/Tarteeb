import { NextRequest } from "next/server";
import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok, parseBody } from "@/lib/api";
import { confirmIntakeSchema } from "@/lib/schemas";

/**
 * POST /api/intake/confirm — explicit, idempotent, atomic confirmation.
 * Requires Idempotency-Key header (or body idempotencyKey). Retries with the
 * same key return the existing order instead of duplicating.
 */
export async function POST(req: NextRequest) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const headerKey = req.headers.get("idempotency-key");
  const parsed = parseBody(confirmIntakeSchema, { ...body, idempotencyKey: body?.idempotencyKey ?? headerKey });
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;
  const repo = getRepo();
  try {
    const conv = await repo.getConversation(s.userId, d.conversationId);
    if (!conv) return fail("not_found", "Conversation not found.", { status: 404 });
    const prop = await repo.getProposal(s.userId, d.proposalId);
    if (!prop || prop.conversationId !== conv.id) {
      return fail("not_found", "Proposal not found in this conversation.", { status: 404 });
    }
    const existing = await repo.findOrderByIdempotency(s.userId, d.idempotencyKey);
    if (existing) {
      if (existing.conversationId !== conv.id || existing.proposalId !== prop.id) {
        return fail("conflict", "This confirmation key belongs to another intake.", { status: 409 });
      }
      return ok({ order: existing, created: false });
    }
    if (conv.status === "confirmed" || prop.status === "confirmed") {
      const order = await repo.orderForProposal(s.userId, prop.id);
      if (order) return ok({ order, created: false });
      return fail("conflict", "This intake already created an order.", { status: 409 });
    }
    if (prop.status === "superseded") return fail("conflict", "Review the latest proposal before confirming.", { status: 409 });
    if (d.clientId) {
      const client = await repo.getClient(s.userId, d.clientId);
      if (!client) return fail("forbidden", "Client does not belong to this account.", { status: 403 });
    }
    const profile = await repo.getProfile(s.userId);
    const { order, created } = await repo.confirmIntake(s.userId, {
      conversationId: d.conversationId,
      proposalId: d.proposalId,
      idempotencyKey: d.idempotencyKey,
      clientId: d.clientId,
      newClientName: d.newClientName,
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
    return ok({ order, created }, created ? 201 : 200);
  } catch (e) {
    const msg = (e as Error).message;
    if (/not owned|not found/.test(msg)) {
      return fail("forbidden", msg, { status: 403 });
    }
    return fail("provider", "Could not confirm the order. Retry with the same confirmation key.", { status: 500, retryable: true });
  }
}
