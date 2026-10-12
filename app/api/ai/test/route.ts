import { NextRequest } from "next/server";
import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { decryptSecret } from "@/lib/crypto";
import { testConnection } from "@/lib/ai/adapter";
import { AIError } from "@/lib/ai/openai";

const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const a = attempts.get(userId);
  if (!a || now > a.resetAt) {
    attempts.set(userId, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  a.count += 1;
  return a.count > 5;
}

/** POST /api/ai/test — verify the stored (or operator) key with a tiny prompt. */
export async function POST(_req: NextRequest) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  if (rateLimited(s.userId)) {
    return fail("ai_rate_limited", "Too many tests. Wait a minute and retry.", { status: 429, retryable: true });
  }
  const repo = getRepo();
  const cipher = await repo.getAIKeyCiphertext(s.userId);
  const settings = await repo.getAISettings(s.userId);
  let key = process.env.AI_OPERATOR_KEY ?? null;
  let model = process.env.AI_OPERATOR_MODEL ?? "gpt-4o-mini";
  let which: "user" | "operator" | null = key ? "operator" : null;
  if (cipher) {
    try {
      key = await decryptSecret(cipher);
      model = settings?.model ?? model;
      which = "user";
    } catch {
      return fail("provider", "Stored key is unreadable (server secret rotated?). Remove and re-enter it.", { status: 500 });
    }
  }
  if (!key) {
    return fail("ai_missing_key", "No AI key configured. Add one in Settings, or use the offline assistant.", { status: 400 });
  }
  try {
    await testConnection(key, model);
    return ok({ ok: true, which, model });
  } catch (e) {
    if (e instanceof AIError) {
      return fail(`ai_${e.code}`, e.message, { status: e.status ?? 502, retryable: e.retryable });
    }
    return fail("ai_provider", "Connection test failed.", { status: 502, retryable: true });
  }
}
