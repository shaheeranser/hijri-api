import { describe, expect, it } from "vitest";
import { COMMITTEE_SOURCES, DIRECT_SOURCES, buildMonthSources, buildSources } from "./sources.js";

describe("buildMonthSources", () => {
  it("builds romanisation queries with a recency filter", () => {
    const sources = buildMonthSources(5);
    const english = sources.filter((source) => source.name.startsWith("Google News (EN"));
    expect(english.length).toBeGreaterThan(0);
    expect(english.length).toBeLessThanOrEqual(3);
    for (const source of english) {
      expect(source.url).toContain("news.google.com/rss/search");
      expect(source.url).toContain("when%3A3d");
    }
    expect(english.some((source) => source.url.includes("Jamadi"))).toBe(true);
  });

  it("adds an Urdu query for the month", () => {
    const sources = buildMonthSources(5);
    expect(sources.some((source) => source.name.includes("UR"))).toBe(true);
  });

  it("covers different months with different queries", () => {
    const jumada = buildMonthSources(5).map((source) => source.url).join("\n");
    const shawwal = buildMonthSources(10).map((source) => source.url).join("\n");
    expect(jumada).not.toBe(shawwal);
  });
});

describe("buildSources", () => {
  it("includes month-aware, committee and direct feeds", () => {
    const sources = buildSources(5);
    const names = sources.map((source) => source.name);
    for (const committee of COMMITTEE_SOURCES) expect(names).toContain(committee.name);
    for (const direct of DIRECT_SOURCES) expect(names).toContain(direct.name);
    expect(sources.length).toBe(buildMonthSources(5).length + COMMITTEE_SOURCES.length + DIRECT_SOURCES.length);
  });

  it("omits month-aware feeds when no month is given", () => {
    expect(buildSources().length).toBe(COMMITTEE_SOURCES.length + DIRECT_SOURCES.length);
  });
});
