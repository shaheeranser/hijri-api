import { describe, expect, it } from "vitest";
import { buildCalendar } from "./calendar.js";
import { hijriYearStart, toHijri } from "./baseline.js";
import type { NormalizedOverrides } from "./overrides.js";

const empty: NormalizedOverrides = { coverageStart: null, months: [] };
const generatedAt = "2026-10-06T00:00:00.000Z";

describe("buildCalendar", () => {
  it("emits one file per Hijri year with baseline confidence", () => {
    const { files, index } = buildCalendar({ hijriYears: [1448], overrides: empty, today: "2026-10-06", generatedAt });
    expect(files).toHaveLength(1);
    expect(files[0]?.hijri_year).toBe(1448);
    expect(files[0]?.days["2026-10-06"]?.confidence).toBe("predicted");
    expect(files[0]?.days[hijriYearStart(1448)]?.confidence).toBe("estimated");
    expect(index).toMatchObject({ coverage_start: null, confirmed_days: 0, hijri_years: [1448] });
  });

  it("counts confirmed days and derives coverage from a confirmed start", () => {
    const start = hijriYearStart(1448);
    const overrides: NormalizedOverrides = {
      coverageStart: start,
      months: [
        {
          hijri: { year: 1448, month: 1, day: 1 },
          hijriKey: "1448-01-01",
          gregorian: start,
          sources: ["https://example.com/a"],
        },
      ],
    };
    const { files, index } = buildCalendar({ hijriYears: [1448], overrides, today: "2026-10-06", generatedAt });
    expect(index.coverage_start).toBe(start);
    expect(index.confirmed_days).toBe(29);
    expect(files[0]?.days[start]?.confidence).toBe("confirmed");
    expect(toHijri(start)).toEqual({ year: 1448, month: 1, day: 1 });
  });
});
