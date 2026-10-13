import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { PROVIDERS, isProviderId, normalizeStoredProvider } from "@/lib/ai/providers";
import { completeForProvider, runIntake, testConnection } from "@/lib/ai/adapter";
import { AIError } from "@/lib/ai/openai";
import { aiSettingsPutSchema, proposalPayloadSchema } from "@/lib/schemas";
import { encryptSecret } from "@/lib/crypto";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
beforeEach(() => { vi.stubEnv("APP_SECRET", "x".repeat(32)); vi.stubEnv("AI_OPERATOR_KEY", ""); });

const payload = {
  title: "New landing page — Ahmed",
  summary: "Landing page for a gym.",
  clientName: "Ahmed",
  deliverables: ["Landing page"],
  requirements: [{ text: "Landing page", source: "explicit" as const }],
  deadline: { dateISO: "2026-10-16", textOriginal: "next Friday", ambiguous: true, interpretation: "Fri 16 Oct 2026" },
  budget: { amount: null, currency: null, unknown: true },
  tasks: [{ title: "Design landing page", isClientRequirement: true }],
  missingEssential: [],
  optionalUnknowns: [],
  assumptions: [],
  language: "en" as const,
};

const profile = { displayName: "Test", timezone: "Africa/Cairo", defaultCurrency: "EGP" } as never;

function openaiOk() {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), { status: 200 });
}

function openaiPing() {
  return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok": true}' } }] }), { status: 200 });
}

describe("BYOK provider registry", () => {
  it("exposes exactly the top-5 providers with fixed HTTPS endpoints", () => {
    expect(PROVIDERS.map((p) => p.id).sort()).toEqual(["anthropic", "deepseek", "google", "openai", "xai"]);
    for (const p of PROVIDERS) {
      expect(p.baseUrl.startsWith("https://")).toBe(true);
      expect(p.models).toContain(p.defaultModel);
      expect(p.keyPlaceholder.length).toBeGreaterThan(0);
    }
  });
  it("maps the legacy stored provider to OpenAI", () => {
    expect(normalizeStoredProvider("openai_compatible")).toBe("openai");
    expect(normalizeStoredProvider("azure")).toBeNull();
    expect(isProviderId("google")).toBe(true);
    expect(isProviderId("azure")).toBe(false);
  });
  it("validates provider ids at the settings boundary", () => {
    expect(aiSettingsPutSchema.safeParse({ provider: "anthropic" }).success).toBe(true);
    expect(aiSettingsPutSchema.safeParse({ provider: "azure" }).success).toBe(false);
  });
});

describe("provider transports", () => {
  it("routes OpenAI-compatible providers to their own base URLs", async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(openaiOk()));
    vi.stubGlobal("fetch", fetch);
    const cipher = await encryptSecret("user-key");
    for (const [id, host] of [["openai", "api.openai.com"], ["xai", "api.x.ai"], ["deepseek", "api.deepseek.com"]] as const) {
      fetch.mockClear();
      const r = await runIntake({ content: "Build a page", profile, history: [], keyCiphertext: cipher, provider: id, model: null });
      expect(r.payload.title).toBe(payload.title);
      expect(String(fetch.mock.calls[0][0])).toContain(host);
    }
  });
  it("routes legacy openai_compatible rows to OpenAI", async () => {
    const fetch = vi.fn().mockResolvedValue(openaiOk());
    vi.stubGlobal("fetch", fetch);
    const cipher = await encryptSecret("user-key");
    await runIntake({ content: "Build a page", profile, history: [], keyCiphertext: cipher, provider: "openai_compatible", model: null });
    expect(String(fetch.mock.calls[0][0])).toContain("api.openai.com");
  });
  it("talks Anthropic Messages with key header and version", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ content: [{ type: "text", text: JSON.stringify(payload) }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const cipher = await encryptSecret("user-key");
    const r = await runIntake({ content: "Build a page", profile, history: [], keyCiphertext: cipher, provider: "anthropic", model: null });
    expect(r.payload.title).toBe(payload.title);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("user-key");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(String(init.body));
    expect(body.system).toContain("STRUCTURE");
    expect(body.max_tokens).toBeGreaterThanOrEqual(4096);
  });
  it("maps Anthropic 401 to the key-rejected message without leaking", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret-body", { status: 401 })));
    const cipher = await encryptSecret("user-key");
    await expect(runIntake({ content: "Build a page", profile, history: [], keyCiphertext: cipher, provider: "anthropic", model: null }))
      .rejects.toThrow("Settings → AI");
  });
  it("talks Gemini generateContent with the key in a header", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const cipher = await encryptSecret("user-key");
    const r = await runIntake({ content: "Build a page", profile, history: [], keyCiphertext: cipher, provider: "google", model: "gemini-2.5-flash" });
    expect(r.payload.title).toBe(payload.title);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("user-key");
    expect(String(url)).not.toContain("user-key");
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });
  it("treats Gemini safety blocks as non-retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ candidates: [], promptFeedback: { blockReason: "SAFETY" } }), { status: 200 })));
    const cipher = await encryptSecret("user-key");
    try {
      await runIntake({ content: "Build a page", profile, history: [], keyCiphertext: cipher, provider: "google", model: null });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AIError);
      expect((e as AIError).retryable).toBe(false);
    }
  });
  it("falls back to the labelled offline assistant without any key", async () => {
    const r = await runIntake({ content: "Ahmed wants a landing page", profile, history: [], keyCiphertext: null, provider: null, model: null });
    expect(r.assistantLabel).toContain("Offline draft");
    expect(proposalPayloadSchema.safeParse(r.payload).success).toBe(true);
  });
  it("verifies each transport with the ping prompt", async () => {
    const fetch = vi.fn()
      .mockImplementationOnce(() => Promise.resolve(openaiPing()))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: "text", text: '{"ok": true}' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '```json\n{"ok": true}\n```' }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await testConnection("k", "gpt-4o-mini", "openai");
    await testConnection("k", "claude-haiku-4-5", "anthropic");
    await testConnection("k", "gemini-2.5-flash", "google");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("uses completeForProvider per transport", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok": true}' }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const def = PROVIDERS.find((p) => p.id === "google")!;
    const text = await completeForProvider(def, { apiKey: "k", model: def.defaultModel, messages: [{ role: "user", content: "hi" }] });
    expect(text).toContain('"ok": true');
  });
});
