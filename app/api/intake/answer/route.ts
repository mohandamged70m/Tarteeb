import { NextRequest } from "next/server";
import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok, parseBody } from "@/lib/api";
import { intakeAnswerSchema } from "@/lib/schemas";
import { runIntake } from "@/lib/ai/adapter";
import { AIError } from "@/lib/ai/openai";

/** POST /api/intake/answer — answer follow-up questions, refresh the proposal. */
export async function POST(req: NextRequest) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseBody(intakeAnswerSchema, body);
  if (!parsed.ok) return parsed.res;
  const repo = getRepo();
  try {
    const conv = await repo.getConversation(s.userId, parsed.data.conversationId);
    if (!conv) return fail("not_found", "Conversation not found.", { status: 404 });
    if (conv.status === "confirmed") {
      return fail("conflict", "This intake already created an order.", { status: 409 });
    }
    const profile = await repo.getProfile(s.userId);
    if (!profile) return fail("not_found", "Profile not found.", { status: 404 });
    const current = await repo.latestProposal(s.userId, conv.id);
    if (!current) return fail("not_found", "No proposal to refine yet.", { status: 404 });

    const answerBlock = parsed.data.answers
      .map((a) => `Q (${a.field}): ${a.answer}`)
      .join("\n");
    await repo.addMessage(s.userId, conv.id, "user", answerBlock);

    const history = await repo.listMessages(s.userId, conv.id);
    const cipher = await repo.getAIKeyCiphertext(s.userId);
    const aiSettings = await repo.getAISettings(s.userId);
    try {
      const result = await runIntake({
        content: `Original request summary: ${current.payload.summary}\nDeliverables so far: ${current.payload.deliverables.join(", ") || "unclear"}`,
        profile: { ...profile, timezone: parsed.data.timezone ?? profile.timezone },
        history: history.map((m) => ({ role: m.role === "system" ? "user" : m.role, content: m.content })),
        priorAnswers: answerBlock,
        keyCiphertext: cipher,
        provider: aiSettings?.provider ?? null,
        model: aiSettings?.model ?? null,
      });
      const proposal = await repo.saveProposal(s.userId, conv.id, result.payload, result.assistantLabel);
      await repo.addMessage(s.userId, conv.id, "assistant", result.payload.summary);
      return ok({ proposal });
    } catch (e) {
      if (e instanceof AIError) {
        return fail(`ai_${e.code}`, e.message, { status: 502, retryable: e.retryable });
      }
      throw e;
    }
  } catch (e) {
    return fail("provider", "Could not complete the request. Please retry.", { status: 500 });
  }
}
