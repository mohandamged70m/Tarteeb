import { describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret, keyHint } from "@/lib/crypto";

describe("key encryption", () => {
  it("round-trips a secret", async () => {
    const cipher = await encryptSecret("sk-test-12345678");
    expect(cipher).not.toContain("sk-test");
    expect(await decryptSecret(cipher)).toBe("sk-test-12345678");
  });
  it("masks keys to last 4", () => {
    expect(keyHint("sk-test-12345678")).toBe("••••5678");
  });
  it("rejects unknown cipher format", async () => {
    await expect(decryptSecret("plain-key")).rejects.toThrow();
  });
});
