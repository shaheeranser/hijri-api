import { describe, expect, it } from "vitest";
import { hijriToGregorian, hijriYearStart, toHijri } from "./baseline.js";

describe("baseline (Umm al-Qura)", () => {
  it("converts a known Gregorian date", () => {
    expect(toHijri("2025-03-01")).toEqual({ year: 1446, month: 9, day: 1 });
  });

  it("inverts back to the same Gregorian date", () => {
    expect(hijriToGregorian({ year: 1446, month: 9, day: 1 })).toBe("2025-03-01");
  });

  it("finds the Gregorian start of a Hijri year", () => {
    const start = hijriYearStart(1446);
    expect(toHijri(start)).toEqual({ year: 1446, month: 1, day: 1 });
  });
});
