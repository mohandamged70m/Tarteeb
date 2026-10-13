/** BYOK provider registry. Endpoints are fixed server-side — never user-supplied (SSRF closed). */

export type ProviderId = "openai" | "anthropic" | "google" | "xai" | "deepseek";

export type ProviderTransport = "openai_chat" | "anthropic_messages" | "gemini_generate";

export interface ProviderDef {
  id: ProviderId;
  /** Display name shown in Settings. */
  label: string;
  transport: ProviderTransport;
  /** Fixed API base URL for this provider. */
  baseUrl: string;
  defaultModel: string;
  /** Suggested models (datalist) — the model field stays free-text. */
  models: string[];
  /** Non-secret placeholder hint for the key input. */
  keyPlaceholder: string;
  /** Where the user gets a key. */
  keyHelp: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "openai",
    label: "OpenAI",
    transport: "openai_chat",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o"],
    keyPlaceholder: "sk-…",
    keyHelp: "Get a key at platform.openai.com → API keys.",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    transport: "anthropic_messages",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-haiku-4-5",
    models: ["claude-haiku-4-5", "claude-sonnet-5-5", "claude-opus-5-5"],
    keyPlaceholder: "sk-ant-…",
    keyHelp: "Get a key at console.anthropic.com → API keys.",
  },
  {
    id: "google",
    label: "Google",
    transport: "gemini_generate",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
    keyPlaceholder: "AIza…",
    keyHelp: "Get a key at Google AI Studio → API keys.",
  },
  {
    id: "xai",
    label: "xAI",
    transport: "openai_chat",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4-fast",
    models: ["grok-4-fast", "grok-4"],
    keyPlaceholder: "xai-…",
    keyHelp: "Get a key at console.x.ai → API keys.",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    transport: "openai_chat",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-flash",
    models: ["deepseek-flash", "deepseek-v4-pro"],
    keyPlaceholder: "sk-…",
    keyHelp: "Get a key at platform.deepseek.com → API keys.",
  },
];

export function isProviderId(v: unknown): v is ProviderId {
  return typeof v === "string" && PROVIDERS.some((p) => p.id === v);
}

export function getProvider(id: ProviderId): ProviderDef {
  const found = PROVIDERS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown AI provider: ${id}`);
  return found;
}

/** Stored settings predate the multi-provider registry; map the legacy value. */
export function normalizeStoredProvider(v: string | null | undefined): ProviderId | null {
  if (v === "openai_compatible") return "openai";
  return isProviderId(v) ? v : null;
}
