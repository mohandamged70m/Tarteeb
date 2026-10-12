import { decryptSecret } from "../crypto";
import type { Profile, ProposalPayload } from "../types";
import { proposalPayloadSchema, MAX_INPUT_CHARS } from "../schemas";
import { AIError, chatCompletionsJSON } from "./openai";
import { buildSystemPrompt, buildUserBlock, REPAIR_HINT, DEFAULT_MODEL, ALLOWED_MODELS } from "./prompts";
import { extractOffline } from "./offline";
import { todayInTimezone, weekdayInTimezone, WEEKDAYS_EN } from "../dates";

export interface IntakeInput {
  content: string;
  profile: Profile;
  history: { role: "user" | "assistant"; content: string }[];
  priorAnswers?: string;
  keyCiphertext: string | null;
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

export async function runIntake(input: IntakeInput): Promise<IntakeResult> {
  if (input.content.length > MAX_INPUT_CHARS) {
    throw new AIError("oversized", `Message exceeds the ${MAX_INPUT_CHARS}-character limit.`, false);
  }
  const ctx = contextFor(input.profile);

  // Resolve key: user key → operator fallback → offline.
  let apiKey: string | null = null;
  let model = DEFAULT_MODEL;
  if (input.keyCiphertext) {
    try {
      apiKey = await decryptSecret(input.keyCiphertext);
      model = input.model && ALLOWED_MODELS.includes(input.model) ? input.model : DEFAULT_MODEL;
    } catch {
      apiKey = null; // corrupted ciphertext → fall through honestly
    }
  }
  if (!apiKey && process.env.AI_OPERATOR_KEY) {
    apiKey = process.env.AI_OPERATOR_KEY;
    model = process.env.AI_OPERATOR_MODEL ?? DEFAULT_MODEL;
  }

  if (!apiKey) {
    const payload = extractOffline(input.content, {
      todayISO: ctx.todayISO,
      todayWeekday: ctx.todayWeekday,
      timezone: ctx.timezone,
      defaultCurrency: ctx.defaultCurrency,
    });
    return { payload, assistantLabel: "Offline draft — not a real model" };
  }

  const system = buildSystemPrompt({
    todayISO: ctx.todayISO,
    todayWeekdayName: ctx.todayWeekdayName,
    timezone: ctx.timezone,
    defaultCurrency: ctx.defaultCurrency,
    history: input.history,
  });
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
    ...input.history.slice(-10).map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user", content: buildUserBlock(input.content, input.priorAnswers) },
  ];

  let raw: string;
  try {
    raw = await chatCompletionsJSON({ apiKey, model, messages });
  } catch (e) {
    if (e instanceof AIError && e.code === "provider" && e.status === 401) {
      throw new AIError("provider", "The API key was rejected. Update it in Settings → AI.", false, 401);
    }
    throw e;
  }

  const parsed = tryParsePayload(raw);
  if (parsed) return { payload: parsed, assistantLabel: `${model}` };

  // One repair retry: re-prompt with the validation error.
  const repaired = await chatCompletionsJSON({
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
    const json = JSON.parse(raw) as unknown;
    const res = proposalPayloadSchema.safeParse(json);
    return res.success ? res.data : null;
  } catch {
    return null;
  }
}

/** Tiny prompt to verify a key without exposing anything sensitive. */
export async function testConnection(apiKey: string, model: string): Promise<void> {
  const raw = await chatCompletionsJSON({
    apiKey,
    model: ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL,
    messages: [
      { role: "system", content: "Reply with exactly this JSON: {\"ok\": true}" },
      { role: "user", content: "ping" },
    ],
    timeoutMs: 20000,
  });
  const json = JSON.parse(raw) as { ok?: boolean };
  if (json.ok !== true) throw new AIError("bad_output", "Unexpected test response.", true);
}
