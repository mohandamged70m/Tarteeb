import { describe, expect, it } from "vitest";
import { resolveWeekday, todayInTimezone, isValidIANA } from "@/lib/dates";

describe("weekday resolution", () => {
  // Tue 2026-10-13 (weekday 2)
  it("'Friday' from Tue 13 Oct → Fri 16 Oct", () => {
    expect(resolveWeekday(5, "none", "2026-10-13", 2)).toBe("2026-10-16");
  });
  it("'next Friday' from Tue 13 Oct → Fri 23 Oct (next week)", () => {
    expect(resolveWeekday(5, "next", "2026-10-13", 2)).toBe("2026-10-23");
  });
  it("'Friday' on a Friday → today", () => {
    expect(resolveWeekday(5, "none", "2026-10-16", 5)).toBe("2026-10-16");
  });
  it("'Monday' from Tuesday → coming Monday", () => {
    expect(resolveWeekday(1, "none", "2026-10-13", 2)).toBe("2026-10-19");
  });
});

describe("timezone helpers", () => {
  it("formats today in Africa/Cairo", () => {
    const d = todayInTimezone("Africa/Cairo", new Date("2026-10-13T10:00:00Z"));
    expect(d).toBe("2026-10-13");
  });
  it("validates IANA names", () => {
    expect(isValidIANA("Africa/Cairo")).toBe(true);
    expect(isValidIANA("Mars/Olympus")).toBe(false);
  });
});
