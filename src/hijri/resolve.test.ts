import { describe, expect, it } from "vitest";
import { toHijri } from "./baseline.js";
import { addDays } from "../dates.js";
import type { ConfirmedMonth } from "./overrides.js";
import { buildTimeline, resolveDay, type ResolveContext } from "./resolve.js";

function month(year: number, m: number, d: number, gregorian: string): ConfirmedMonth {
  return {
    hijri: { year, month: m, day: d },
    hijriKey: `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    gregorian,
    sources: ["https://example.com/src"],
  };
}

function context(months: ConfirmedMonth[], today: string): ResolveContext {
  return { timeline: buildTimeline(months), today };
}

describe("resolveDay with confirmed months", () => {
  const adjacent = [month(1446, 9, 1, "2025-03-01"), month(1446, 10, 1, "2025-03-30")];

  it("resolves days inside a confirmed month", () => {
    const ctx = context(adjacent, "2025-03-01");
    expect(resolveDay("2025-03-01", ctx)).toMatchObject({ hijri: "1446-09-01", confidence: "confirmed" });
    expect(resolveDay("2025-03-29", ctx)).toMatchObject({ hijri: "1446-09-29", confidence: "confirmed" });
  });

  it("uses the confirmed next start as the month boundary", () => {
    const ctx = context(adjacent, "2025-03-01");
    expect(resolveDay("2025-03-30", ctx)).toMatchObject({ hijri: "1446-10-01", confidence: "confirmed", sources: ["https://example.com/src"] });
  });

  it("treats the last confirmed month's 30th day as unconfirmed", () => {
    const last = [month(1446, 10, 1, "2025-03-30")];
    const ctx = context(last, "2025-03-30");
    expect(resolveDay("2025-04-27", ctx)).toMatchObject({ hijri: "1446-10-29", confidence: "confirmed" });
    expect(resolveDay("2025-04-28", ctx)).toMatchObject({ hijri: "1446-10-30", confidence: "unconfirmed" });
    expect(resolveDay("2025-04-29", ctx).confidence).not.toBe("confirmed");
  });
});

describe("resolveDay baseline fallback", () => {
  const ctx = context([], "2026-01-01");

  it("marks past months estimated", () => {
    expect(resolveDay("2025-05-01", ctx).confidence).toBe("estimated");
  });

  it("marks future months predicted", () => {
    expect(resolveDay("2026-10-06", ctx).confidence).toBe("predicted");
  });

  it("marks a future month's last day unconfirmed", () => {
    let date = "2026-02-01";
    for (let i = 0; i < 400; i += 1) {
      if (toHijri(date).day === 29 && toHijri(addDays(date, 1)).day === 1) break;
      date = addDays(date, 1);
    }
    expect(resolveDay(date, ctx).confidence).toBe("unconfirmed");
  });
});
