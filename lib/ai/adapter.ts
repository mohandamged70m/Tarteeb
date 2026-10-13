import { decryptSecret } from "../crypto";
import type { Profile, ProposalPayload } from "../types";
import { proposalPayloadSchema, MAX_INPUT_CHARS } from "../schemas";
import { AIError, chatCompletionsJSON, type ChatTurn } from "./openai";
import { anthropicMessagesJSON } from "./anthropic";
import { geminiGenerateJSON } from "./gemini";
import { getProvider, normalizeStoredProvider, type ProviderDef, type ProviderId } from "./providers";
import { buildSystemPrompt, buildUserBlock, REPAIR_HINT, DEFAULT_MODEL, AI_BASE_URL } from "./prompts";
import { extractOffline } from "./offline";
import { todayInTimezone, weekdayInTimezone, WEEKDAYS_EN } from "../dates";

export interface IntakeInput {
  content: string;
  profile: Profile;
  history: { role: "user" | "assistant"; content: string }[];
  priorAnswers?: string;
  keyCiphertext: string | null;
  /** Stored provider id (legacy "openai_compatible" is mapped to "openai"). */
  provider: string | null;
  model: string | null;
}

export interface IntakeResult {
  payload: ProposalPayload;
  assistantLabel: string;
}

function contextFor(profile: Profile, timezone?: string) {
  const tz = timezone || profile.timezone || "UTC";
  const now = new Date();
  return {
    todayISO: todayInTimezone(tz, now),
    todayWeekday: weekdayInTimezone(tz, now),
    timezone: tz,
    defaultCurrency: profile.defaultCurrency,
    todayWeekdayName: WEEKDAYS_EN[weekdayInTimezone(tz, now)],
  };
}

/** Route one completion through the provider's transport. Endpoints stay fixed. */
export async function completeForProvider(
  def: ProviderDef,
  opts: { apiKey: string; model: string; messages: ChatTurn[]; timeoutMs?: number },
): Promise<string> {
  switch (def.transport) {
    case "anthropic_messages":
      return anthropicMessagesJSON(opts);
    case "gemini_generate":
      return geminiGenerateJSON(opts);
    case "openai_chat":
    default:
      return chatCompletionsJSON({
        ...opts,
        // Operator self-host override applies to the OpenAI transport only.
        baseUrl: def.id === "openai" ? AI_BASE_URL : def.baseUrl,
      });
  }
}

function cleanModel(input: string | null, fallback: string): string {
  const m = input?.trim();
  return m ? m : fallback;
}

export async function runIntake(input: IntakeInput): Promise<IntakeResult> {
  if (input.content.length > MAX_INPUT_CHARS) {
    throw new AIError("oversized", `Message exceeds the ${MAX_INPUT_CHARS}-character limit.`, false);
  }
  const ctx = contextFor(input.profile);

  // Resolve key: user BYOK key (+ provider) → operator fallback → offline.
  let apiKey: string | null = null;
  let provider: ProviderDef | null = null;
  let model = DEFAULT_MODEL;
  const stored = normalizeStoredProvider(input.provider);
  if (input.keyCiphertext && stored) {
    try {
      apiKey = await decryptSecret(input.keyCiphertext);
      provider = getProvider(stored);
      model = cleanModel(input.model, provider.defaultModel);
    } catch {
      apiKey = null; // corrupted ciphertext → fall through honestly
      provider = null;
    }
  }
  if (!apiKey && process.env.AI_OPERATOR_KEY) {
    apiKey = process.env.AI_OPERATOR_KEY;
    provider = getProvider("openai");
    model = cleanModel(process.env.AI_OPERATOR_MODEL ?? null, DEFAULT_MODEL);
  }

  if (!apiKey || !provider) {
    const content = [...input.history.filter((h) => h.role === "user").map((h) => h.content), input.content, input.priorAnswers ?? ""].join("\n");
    const payload = proposalPayloadSchema.parse(extractOffline(content, {
      todayISO: ctx.todayISO,
      todayWeekday: ctx.todayWeekday,
      timezone: ctx.timezone,
      defaultCurrency: ctx.defaultCurrency,
    }));
    return { payload, assistantLabel: "Offline draft — not a real model" };
  }

  const system = buildSystemPrompt({
    todayISO: ctx.todayISO,
    todayWeekdayName: ctx.todayWeekdayName,
    timezone: ctx.timezone,
    defaultCurrency: ctx.defaultCurrency,
    history: input.history,
  });
  const messages: ChatTurn[] = [
    { role: "system", content: system },
    ...input.history.slice(-10).map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user", content: buildUserBlock(input.content, input.priorAnswers) },
  ];

  let raw: string;
  try {
    raw = await completeForProvider(provider, { apiKey, model, messages });
  } catch (e) {
    if (e instanceof AIError && e.code === "provider" && e.status === 401) {
      throw new AIError("provider", "The API key was rejected. Update it in Settings → AI.", false, 401);
    }
    throw e;
  }

  const parsed = tryParsePayload(raw);
  if (parsed) return { payload: parsed, assistantLabel: `${model}` };

  // One repair retry: re-prompt with the validation error.
  const repaired = await completeForProvider(provider, {
    apiKey,
    model,
    messages: [...messages, { role: "assistant", content: raw }, { role: "user", content: REPAIR_HINT }],
  });
  const parsed2 = tryParsePayload(repaired);
  if (parsed2) return { payload: parsed2, assistantLabel: `${model}` };
  throw new AIError("bad_output", "The AI returned an unusable response. Nothing was saved — retry.", true);
}

function tryParsePayload(raw: string): ProposalPayload | null {
  try {
    const res = proposalPayloadSchema.safeParse(JSON.parse(extractJSON(raw)) as unknown);
    return res.success ? res.data : null;
  } catch {
    return null;
  }
}

/** Strip markdown code fences some providers wrap around JSON. */
function extractJSON(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fence ? fence[1] : raw).trim();
}

/** Tiny prompt to verify a key without exposing anything sensitive. */
export async function testConnection(apiKey: string, model: string, providerId: ProviderId = "openai"): Promise<void> {
  const def = getProvider(providerId);
  const raw = await completeForProvider(def, {
    apiKey,
    model: cleanModel(model, def.defaultModel),
    messages: [
      { role: "system", content: "Reply with exactly this JSON: {\"ok\": true}" },
      { role: "user", content: "ping" },
    ],
    timeoutMs: 20000,
  });
  const json = JSON.parse(extractJSON(raw)) as { ok?: boolean };
  if (json.ok !== true) throw new AIError("bad_output", "Unexpected test response.", true);
}
