import { AIError, type ChatTurn } from "./openai";
import { AI_TIMEOUT_MS } from "./prompts";

/** Fixed Anthropic base URL — never user-supplied. */
export const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

/** Minimal Anthropic Messages client returning the assistant text. */
export async function anthropicMessagesJSON(opts: {
  apiKey: string;
  model: string;
  messages: ChatTurn[];
  timeoutMs?: number;
}): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? AI_TIMEOUT_MS);
  try {
    const system = opts.messages.find((m) => m.role === "system")?.content;
    const rest = opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    const res = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": opts.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: 8192,
        ...(system ? { system } : {}),
        messages: rest,
      }),
    });
    if (res.status === 401) {
      throw new AIError("provider", "The API key was rejected. Check it in Settings.", false, 401);
    }
    if (res.status === 429) {
      throw new AIError("rate_limited", "Rate limited by the provider. Wait a moment and retry.", true, 429);
    }
    if (!res.ok) {
      throw new AIError("provider", `The AI provider returned an error (${res.status}). Retry or check your settings.`, res.status >= 500, res.status);
    }
    const json = (await res.json()) as {
      content?: { type?: string; text?: string }[];
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text as string)
      .join("");
    if (!text) throw new AIError("bad_output", "Empty response from provider.", true);
    return text;
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new AIError("timeout", "The AI request timed out. Retry.", true);
    }
    throw new AIError("provider", "Could not reach the AI provider. Retry shortly.", true);
  } finally {
    clearTimeout(timer);
  }
}
