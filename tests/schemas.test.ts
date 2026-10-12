import { describe, expect, it } from "vitest";
import { proposalPayloadSchema } from "@/lib/schemas";

const base = {
  title: "New landing page — Ahmed",
  summary: "Landing page for a gym.",
  clientName: "Ahmed",
  deliverables: ["Landing page"],
  requirements: [{ text: "Landing page", source: "explicit" as const }],
  deadline: {
    dateISO: "2026-10-16",
    textOriginal: "next Friday",
    ambiguous: true,
    interpretation: "Fri 16 Oct 2026",
  },
  budget: { amount: null, currency: null, unknown: true },
  tasks: [{ title: "Design landing page", isClientRequirement: true }],
  missingEssential: [],
  optionalUnknowns: ["Budget: Unknown / decide later"],
  assumptions: [],
  language: "en" as const,
};

describe("proposal schema", () => {
  it("accepts a well-formed payload", () => {
    expect(proposalPayloadSchema.safeParse(base).success).toBe(true);
  });
  it("rejects non-date-only deadlines", () => {
    const bad = { ...base, deadline: { ...base.deadline, dateISO: "2026-10-16T15:00:00" } };
    expect(proposalPayloadSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects lowercase currency codes", () => {
    const bad = { ...base, budget: { amount: 100, currency: "egp", unknown: false } };
    expect(proposalPayloadSchema.safeParse(bad).success).toBe(false);
  });
  it("caps clarification questions at 3", () => {
    const bad = {
      ...base,
      missingEssential: [1, 2, 3, 4].map((i) => ({ field: `f${i}`, question: `q${i}` })),
    };
    expect(proposalPayloadSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects empty titles", () => {
    expect(proposalPayloadSchema.safeParse({ ...base, title: "ab" }).success).toBe(false);
  });
});
