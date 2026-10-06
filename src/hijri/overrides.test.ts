import { describe, expect, it } from "vitest";
import { OverridesValidationError, parseOverrides } from "./overrides.js";

const valid = {
  coverage_start: "2025-03-01",
  months: { "1446-09-01": { date: "2025-03-01", sources: ["https://example.com/a"] } },
};

describe("parseOverrides", () => {
  it("accepts a valid record and normalises fields", () => {
    const result = parseOverrides(valid);
    expect(result.coverageStart).toBe("2025-03-01");
    expect(result.months).toHaveLength(1);
    expect(result.months[0]).toMatchObject({ hijriKey: "1446-09-01", gregorian: "2025-03-01" });
  });

  it("accepts an empty record", () => {
    expect(parseOverrides({ coverage_start: null, months: {} }).months).toEqual([]);
  });

  it("sorts months by Gregorian date", () => {
    const result = parseOverrides({
      coverage_start: null,
      months: {
        "1446-10-01": { date: "2025-03-30", sources: ["https://example.com/b"] },
        "1446-09-01": { date: "2025-03-01", sources: ["https://example.com/a"] },
      },
    });
    expect(result.months.map((month) => month.gregorian)).toEqual(["2025-03-01", "2025-03-30"]);
  });

  it("requires at least one source", () => {
    expect(() =>
      parseOverrides({ coverage_start: null, months: { "1446-09-01": { date: "2025-03-01", sources: [] } } }),
    ).toThrow(OverridesValidationError);
  });

  it("rejects a non-URL source", () => {
    expect(() =>
      parseOverrides({ coverage_start: null, months: { "1446-09-01": { date: "2025-03-01", sources: ["not a url"] } } }),
    ).toThrow(OverridesValidationError);
  });

  it("rejects an invalid Gregorian date", () => {
    expect(() =>
      parseOverrides({ coverage_start: null, months: { "1446-09-01": { date: "2025-02-30", sources: ["https://example.com/a"] } } }),
    ).toThrow(OverridesValidationError);
  });

  it("rejects a malformed Hijri key", () => {
    expect(() =>
      parseOverrides({ coverage_start: null, months: { "1446-13-01": { date: "2025-03-01", sources: ["https://example.com/a"] } } }),
    ).toThrow(OverridesValidationError);
  });

  it("rejects two months starting on the same day", () => {
    expect(() =>
      parseOverrides({
        coverage_start: null,
        months: {
          "1446-09-01": { date: "2025-03-01", sources: ["https://example.com/a"] },
          "1446-10-01": { date: "2025-03-01", sources: ["https://example.com/b"] },
        },
      }),
    ).toThrow(OverridesValidationError);
  });
});
