import { NextRequest } from "next/server";
import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok, parseBody } from "@/lib/api";
import { intakeMessageSchema } from "@/lib/schemas";
import { runIntake } from "@/lib/ai/adapter";
import { AIError } from "@/lib/ai/openai";

function aiFail(e: unknown) {
  if (e instanceof AIError) {
    const status =
      e.code === "missing_key" ? 400
      : e.code === "oversized" ? 413
      : e.code === "rate_limited" ? 429
      : e.code === "timeout" ? 504
      : e.code === "bad_output" ? 502
      : 502;
    return fail(`ai_${e.code}`, e.message, { status, retryable: e.retryable });
  }
  return fail("ai_provider", "The assistant failed. Nothing was saved — retry.", {
    status: 502,
    retryable: true,
  });
}

/** POST /api/intake/message — paste a client message, get a proposal draft. */
export async function POST(req: NextRequest) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseBody(intakeMessageSchema, body);
  if (!parsed.ok) {
    if (String(body?.content ?? "").length > 12000) {
      return fail("oversized", "Message exceeds the character limit.", { status: 413 });
    }
    return parsed.res;
  }
  const repo = getRepo();
  try {
    const conv = await repo.getConversation(s.userId, parsed.data.conversationId);
    if (!conv) return fail("not_found", "Conversation not found.", { status: 404 });
    if (conv.status === "confirmed") {
      return fail("conflict", "This intake already created an order. Start a new intake for follow-up work.", { status: 409 });
    }
    const profile = await repo.getProfile(s.userId);
    if (!profile) return fail("not_found", "Profile not found.", { status: 404 });
    const history = await repo.listMessages(s.userId, conv.id);
    const cipher = await repo.getAIKeyCiphertext(s.userId);
    const aiSettings = await repo.getAISettings(s.userId);

    // Persist the user turn FIRST so refreshes never lose input.
    await repo.addMessage(s.userId, conv.id, "user", parsed.data.content);

    let result;
    try {
      result = await runIntake({
        content: parsed.data.content,
        profile: { ...profile, timezone: parsed.data.timezone ?? profile.timezone },
        history: history.map((m) => ({ role: m.role === "system" ? "user" : m.role, content: m.content })),
        keyCiphertext: cipher,
        provider: aiSettings?.provider ?? null,
        model: aiSettings?.model ?? null,
      });
    } catch (e) {
      // AI failed — user message is preserved; client can retry.
      return aiFail(e);
    }

    const proposal = await repo.saveProposal(s.userId, conv.id, result.payload, result.assistantLabel);
    const assistantText = buildAssistantText(result.payload);
    await repo.addMessage(s.userId, conv.id, "assistant", assistantText);
    return ok({ proposal, assistantText });
  } catch (e) {
    return fail("provider", "Could not complete the request. Please retry.", { status: 500 });
  }
}

function buildAssistantText(p: {
  summary: string;
  missingEssential: { question: string }[];
  assumptions: { text: string }[];
}): string {
  let text = p.summary;
  if (p.assumptions.length) {
    text += "\n\nMy reading: " + p.assumptions.map((a) => a.text).join("; ") + ".";
  }
  if (p.missingEssential.length) {
    text += "\n\nTo finish this I need:\n" + p.missingEssential.map((q, i) => `${i + 1}. ${q.question}`).join("\n");
  } else {
    text += "\n\nReview the proposal below, edit anything, then create the order.";
  }
  return text;
}
