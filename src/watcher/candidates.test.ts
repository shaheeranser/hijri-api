import { describe, expect, it } from "vitest";
import { buildCandidates, isPollingWindow } from "./candidates.js";

describe("buildCandidates", () => {
  it("offers the 29th and 30th day after the last confirmed start", () => {
    const pair = buildCandidates("2025-03-01", "Asia/Karachi");
    expect(pair.twentyNinth).toBe("2025-03-29");
    expect(pair.candidates.map((candidate) => candidate.date)).toEqual(["2025-03-30", "2025-03-31"]);
    expect(pair.candidates[0]).toMatchObject({ weekday: "Sunday", weekdayUr: "اتوار" });
    expect(pair.candidates[1]).toMatchObject({ weekday: "Monday", weekdayUr: "پیر" });
  });
});

describe("isPollingWindow", () => {
  const lastStart = "2025-03-01";
  const maghrib = new Date("2025-03-29T18:30:00+05:00");

  it("is closed before Maghrib on the 29th", () => {
    expect(isPollingWindow(lastStart, new Date("2025-03-29T18:00:00+05:00"), maghrib)).toBe(false);
  });

  it("opens after Maghrib on the 29th", () => {
    expect(isPollingWindow(lastStart, new Date("2025-03-29T19:00:00+05:00"), maghrib)).toBe(true);
  });

  it("stays open through the 30th", () => {
    expect(isPollingWindow(lastStart, new Date("2025-03-30T10:00:00+05:00"), maghrib)).toBe(true);
  });

  it("closes at the start of the 31st day", () => {
    expect(isPollingWindow(lastStart, new Date("2025-03-31T10:00:00+05:00"), maghrib)).toBe(false);
  });
});
