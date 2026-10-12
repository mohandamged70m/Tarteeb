import { NextRequest } from "next/server";
import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok, parseBody } from "@/lib/api";
import { aiSettingsPutSchema } from "@/lib/schemas";
import { encryptSecret, keyHint } from "@/lib/crypto";
import { ALLOWED_MODELS, DEFAULT_MODEL } from "@/lib/ai/prompts";

export async function GET() {
  try {
    const s = await requireSession();
    const ai = await getRepo().getAISettings(s.userId);
    return ok({
      ai: ai ? { provider: ai.provider, model: ai.model, keyHint: ai.keyHint } : null,
      allowedModels: ALLOWED_MODELS,
      hasOperatorKey: Boolean(process.env.AI_OPERATOR_KEY),
    });
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseBody(aiSettingsPutSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;
  const repo = getRepo();
  const existing = await repo.getAISettings(s.userId);
  const cipher = await repo.getAIKeyCiphertext(s.userId);

  if (d.model && !ALLOWED_MODELS.includes(d.model)) {
    return fail("validation", `Model must be one of: ${ALLOWED_MODELS.join(", ")}`, { status: 400 });
  }
  let keyCiphertext = cipher;
  let hint = existing?.keyHint ?? null;
  if (d.apiKey === null) {
    keyCiphertext = null;
    hint = null;
  } else if (typeof d.apiKey === "string" && d.apiKey.length > 0) {
    try {
      keyCiphertext = await encryptSecret(d.apiKey);
    } catch {
      return fail("provider", "Server key encryption is not configured (APP_SECRET).", { status: 500 });
    }
    hint = keyHint(d.apiKey);
  }
  const saved = await repo.saveAISettings(s.userId, {
    userId: s.userId,
    provider: d.provider ?? existing?.provider ?? (keyCiphertext ? "openai_compatible" : "offline"),
    model: d.model ?? existing?.model ?? DEFAULT_MODEL,
    keyHint: hint,
    updatedAt: new Date().toISOString(),
    keyCiphertext,
  });
  // Never return ciphertext — only metadata.
  return ok({ ai: { provider: saved.provider, model: saved.model, keyHint: saved.keyHint } });
}
