import { describe, expect, it } from "vitest";
import type { Article } from "./sources.js";
import type { Extraction } from "./extract.js";
import { applyProposal, buildProposal, countPublishers, renderPullRequestBody } from "./proposal.js";

const candidates = [
  { date: "2025-03-30", weekday: "Sunday", weekdayUr: "اتوار" },
  { date: "2025-03-31", weekday: "Monday", weekdayUr: "پیر" },
] as const;

function agreement(publisher: string, link: string): { article: Article; extraction: Extraction } {
  return {
    article: { title: `Ramadan begins ${link}`, link, publisher, feed: "test" },
    extraction: { date: "2025-03-30", evidence: "parsed date", strength: "strong" },
  };
}

const agreements = [agreement("Dawn", "https://dawn.com/a"), agreement("Geo", "https://geo.tv/b")];

describe("buildProposal", () => {
  it("targets the month after the last confirmed start", () => {
    const proposal = buildProposal({
      lastConfirmed: { year: 1446, month: 9, day: 1 },
      gregorian: "2025-03-30",
      candidates: [...candidates],
      agreements,
      detectedAt: "2025-03-29T20:00:00.000Z",
    });
    expect(proposal.hijriKey).toBe("1446-10-01");
    expect(proposal.sources).toEqual(["https://dawn.com/a", "https://geo.tv/b"]);
    expect(countPublishers(agreements)).toBe(2);
  });
});

describe("applyProposal", () => {
  it("adds the entry, preserves other keys, and sets coverage_start", () => {
    const proposal = buildProposal({
      lastConfirmed: { year: 1446, month: 9, day: 1 },
      gregorian: "2025-03-30",
      candidates: [...candidates],
      agreements,
      detectedAt: "2025-03-29T20:00:00.000Z",
    });
    const raw = {
      $schema: "./overrides.schema.json",
      coverage_start: null,
      months: { "1446-09-01": { date: "2025-03-01", sources: ["https://example.com/a"] } },
    };
    const updated = applyProposal(raw, proposal);
    expect(updated.coverage_start).toBe("2025-03-01");
    expect(updated.months["1446-10-01"]).toEqual({ date: "2025-03-30", sources: ["https://dawn.com/a", "https://geo.tv/b"] });
    expect(updated.$schema).toBe("./overrides.schema.json");
  });
});

describe("renderPullRequestBody", () => {
  it("includes the date, candidates and evidence", () => {
    const proposal = buildProposal({
      lastConfirmed: { year: 1446, month: 9, day: 1 },
      gregorian: "2025-03-30",
      candidates: [...candidates],
      agreements,
      detectedAt: "2025-03-29T20:00:00.000Z",
    });
    const body = renderPullRequestBody(proposal);
    expect(body).toContain("2025-03-30");
    expect(body).toContain("Dawn");
    expect(body).toContain("1446-10-01");
  });
});
