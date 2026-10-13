import { describe, expect, it, vi, afterEach } from "vitest";
import { productionConfigErrors, assertProductionConfig } from "@/lib/env";
import { intakeMessageSchema, orderPatchSchema } from "@/lib/schemas";
import { chatCompletionsJSON } from "@/lib/ai/openai";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("public launch regressions", () => {
  it("fails closed when production has no configuration", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(productionConfigErrors({})).toContain("SUPABASE_SERVICE_ROLE_KEY is required");
    expect(() => assertProductionConfig()).toThrow(/configuration/);
  });
  it("accepts complete HTTPS production configuration, rejecting insecure origins", () => {
    const env = { APP_URL: "https://tarteeb.example.com", NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "server", APP_SECRET: "x".repeat(64) };
    expect(productionConfigErrors(env)).toEqual([]);
    expect(productionConfigErrors({ ...env, APP_URL: "http://localhost:3000" })).toContain("APP_URL must be an HTTPS origin");
  });
  it("rejects impossible dates and invalid IANA timezone input", () => {
    expect(orderPatchSchema.safeParse({ deadlineDate: "2026-02-30" }).success).toBe(false);
    expect(orderPatchSchema.safeParse({ deadlineDate: "2028-02-29" }).success).toBe(true);
    expect(intakeMessageSchema.safeParse({ conversationId: crypto.randomUUID(), content: "Build a page", timezone: "Cairo-ish" }).success).toBe(false);
  });
  it("does not leak upstream response text containing secrets", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret-api-key-private", { status: 500 })));
    await expect(chatCompletionsJSON({ apiKey: "key", model: "model", messages: [] })).rejects.toThrow("AI provider returned an error (500)");
    try { await chatCompletionsJSON({ apiKey: "key", model: "model", messages: [] }); }
    catch (e) { expect(String(e)).not.toContain("secret-api-key-private"); }
  });
});

it("manual creation needs no intake confirmation key", async () => {
  const { orderCreateSchema } = await import("@/lib/schemas");
  expect(orderCreateSchema.safeParse({ title: "Landing page", tasks: [{ title: "Build" }] }).success).toBe(true);
});
