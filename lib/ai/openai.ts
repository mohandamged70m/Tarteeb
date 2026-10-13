import { AI_BASE_URL, AI_TIMEOUT_MS } from "./prompts";

export type AICode =
  | "bad_output"
  | "provider"
  | "timeout"
  | "rate_limited"
  | "missing_key"
  | "oversized"
  | "aborted";

export class AIError extends Error {
  code: AICode;
  retryable: boolean;
  status?: number;
  constructor(code: AICode, message: string, retryable = true, status?: number) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Minimal OpenAI-compatible chat-completions client (fixed base URL, JSON mode). */
export async function chatCompletionsJSON(opts: {
  apiKey: string;
  model: string;
  messages: ChatTurn[];
  timeoutMs?: number;
  /** Fixed provider base URL. Defaults to AI_BASE_URL (OpenAI). */
  baseUrl?: string;
}): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${opts.baseUrl ?? AI_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: opts.messages,
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
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new AIError("bad_output", "Empty response from provider.", true);
    return content;
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
