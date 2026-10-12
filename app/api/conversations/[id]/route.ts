import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const s = await requireSession();
    const { id } = await params;
    const repo = getRepo();
    const conv = await repo.getConversation(s.userId, id);
    if (!conv) return fail("not_found", "Conversation not found.", { status: 404 });
    const messages = await repo.listMessages(s.userId, id);
    const proposal = await repo.latestProposal(s.userId, id);
    const order = proposal?.status === "confirmed"
      ? await repo.orderForProposal(s.userId, proposal.id)
      : null;
    return ok({ conversation: conv, messages, proposal, orderId: order?.id ?? null });
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
}
