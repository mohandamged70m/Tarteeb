import { AIError, type ChatTurn } from "./openai";
import { AI_TIMEOUT_MS } from "./prompts";

/** Fixed Google AI base URL — never user-supplied. Key travels in a header, not the URL. */
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/** Minimal Gemini generateContent client returning the model text. */
export async function geminiGenerateJSON(opts: {
  apiKey: string;
  model: string;
  messages: ChatTurn[];
  timeoutMs?: number;
}): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? AI_TIMEOUT_MS);
  try {
    const system = opts.messages.find((m) => m.role === "system")?.content;
    const contents = opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    const res = await fetch(
      `${GEMINI_BASE_URL}/models/${encodeURIComponent(opts.model)}:generateContent`,
      {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": opts.apiKey,
        },
        body: JSON.stringify({
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents,
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
          },
        }),
      },
    );
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new AIError("provider", "The API key was rejected. Check it in Settings.", false, res.status);
    }
    if (res.status === 429) {
      throw new AIError("rate_limited", "Rate limited by the provider. Wait a moment and retry.", true, 429);
    }
    if (!res.ok) {
      throw new AIError("provider", `The AI provider returned an error (${res.status}). Retry or check your settings.`, res.status >= 500, res.status);
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    const text = (json.candidates ?? [])
      .flatMap((c) => c.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
    if (!text) {
      const blocked = json.promptFeedback?.blockReason ||
        json.candidates?.some((c) => c.finishReason === "SAFETY");
      if (blocked) {
        throw new AIError("bad_output", "The provider declined to answer. Rephrase and retry.", false);
      }
      throw new AIError("bad_output", "Empty response from provider.", true);
    }
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
