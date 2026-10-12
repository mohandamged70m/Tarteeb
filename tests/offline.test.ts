import { describe, expect, it } from "vitest";
import { extractOffline } from "@/lib/ai/offline";

const ctx = { todayISO: "2026-10-13", todayWeekday: 2, timezone: "Africa/Cairo", defaultCurrency: "EGP" };

describe("offline extractor", () => {
  it("handles the Ahmed gym example without inventing a price", () => {
    const p = extractOffline("Ahmed wants a landing page for his gym next Friday.", ctx);
    expect(p.clientName).toBe("Ahmed");
    expect(p.deliverables).toContain("Landing page");
    expect(p.deadline.ambiguous).toBe(true);
    expect(p.deadline.dateISO).toBe("2026-10-23");
    expect(p.budget.unknown).toBe(true);
    expect(p.budget.amount).toBeNull();
    expect(p.missingEssential.length).toBeGreaterThan(0);
    expect(p.missingEssential.length).toBeLessThanOrEqual(3);
  });

  it("extracts explicit budget + currency", () => {
    const p = extractOffline("Landing page for Sara, budget 8000 EGP, delivery Friday.", ctx);
    expect(p.budget.amount).toBe(8000);
    expect(p.budget.currency).toBe("EGP");
  });

  it("handles Egyptian Arabic", () => {
    const p = extractOffline("أحمد عايز لاندنج بيج للجيم بتاعه تتسلم الجمعة الجاية.", ctx);
    expect(p.language === "ar" || p.language === "mixed").toBe(true);
    expect(p.deliverables).toContain("Landing page");
    expect(p.deadline.dateISO).not.toBeNull();
  });

  it("handles mixed input", () => {
    const p = extractOffline("Client Ahmed عايز logo بسرعة, budget 2000 جنيه.", ctx);
    expect(p.language).toBe("mixed");
    expect(p.deliverables).toContain("Logo");
    expect(p.budget.amount).toBe(2000);
  });

  it("marks explicit vs suggested separately", () => {
    const p = extractOffline("Ahmed wants a landing page.", ctx);
    expect(p.requirements.every((r) => r.source === "explicit" || r.source === "suggested")).toBe(true);
  });
});
