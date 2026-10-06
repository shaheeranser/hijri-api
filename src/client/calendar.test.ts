import { describe, expect, it } from "vitest";
import type { HijriDayEntry } from "../types.js";
import { HijriCalendar, OutOfRangeError, hijriDate } from "./calendar.js";

function entry(hijri: string, day: number, confidence: HijriDayEntry["confidence"] = "confirmed"): HijriDayEntry {
  return { hijri, year: 1447, month: 9, day, month_name: { en: "Ramadan", ur: "رمضان" }, confidence, sources: ["https://example.com/a"] };
}

const calendar = new HijriCalendar(
  new Map([
    ["2026-02-18", entry("1447-09-01", 1)],
    ["2026-02-19", entry("1447-09-02", 2)],
  ]),
  "2026-02-18",
);

describe("hijriDate", () => {
  it("uses the midnight-based date by default", () => {
    const result = hijriDate(new Date("2026-02-18T20:00:00+05:00"), { calendar });
    expect(result).toMatchObject({ gregorian: "2026-02-18", hijri: "1447-09-01", afterMaghrib: false });
  });

  it("stays on the civil date before Maghrib", () => {
    const result = hijriDate(new Date("2026-02-18T18:00:00+05:00"), {
      calendar,
      afterMaghrib: true,
      maghrib: new Date("2026-02-18T18:30:00+05:00"),
    });
    expect(result).toMatchObject({ gregorian: "2026-02-18", afterMaghrib: false });
  });

  it("rolls to the next day after Maghrib when asked", () => {
    const result = hijriDate(new Date("2026-02-18T19:00:00+05:00"), {
      calendar,
      afterMaghrib: true,
      maghrib: new Date("2026-02-18T18:30:00+05:00"),
    });
    expect(result).toMatchObject({ gregorian: "2026-02-19", hijri: "1447-09-02", afterMaghrib: true });
  });

  it("throws OutOfRangeError for uncovered dates", () => {
    expect(() => hijriDate(new Date("2030-01-01T12:00:00+05:00"), { calendar })).toThrow(OutOfRangeError);
  });

  it("requires a Maghrib instant for afterMaghrib", () => {
    expect(() => hijriDate(new Date("2026-02-18T19:00:00+05:00"), { calendar, afterMaghrib: true })).toThrow();
  });
});
