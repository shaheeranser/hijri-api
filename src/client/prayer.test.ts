import { describe, expect, it } from "vitest";
import type { HijriDayEntry, PrayerFile } from "../types.js";
import { PrayerTable, sehriIftar } from "./prayer.js";

const file: PrayerFile = {
  city: "karachi",
  city_name: "Karachi",
  province: "Sindh",
  profile: "shia_jafari",
  profile_label: "Shia (Jafari)",
  year: 2026,
  timezone: "Asia/Karachi",
  generated_at: "2026-01-01T00:00:00.000Z",
  disclaimer: "test",
  sehri_offset_min: -10,
  iftar_offset_min: 2,
  days: {
    "2026-02-18": {
      date: "2026-02-18",
      times: {
        fajr: "2026-02-18T05:30:00+05:00",
        sunrise: "2026-02-18T07:00:00+05:00",
        dhuhr: "2026-02-18T12:30:00+05:00",
        asr: "2026-02-18T15:45:00+05:00",
        maghrib: "2026-02-18T18:30:00+05:00",
        isha: "2026-02-18T19:55:00+05:00",
      },
    },
  },
};

const table = new PrayerTable(file);

function hijri(month: number): HijriDayEntry {
  return { hijri: `1447-${String(month).padStart(2, "0")}-01`, year: 1447, month, day: 1, month_name: { en: "", ur: "" }, confidence: "confirmed" };
}

describe("PrayerTable", () => {
  it("returns the Maghrib instant for a day", () => {
    expect(table.maghrib("2026-02-18")?.toISOString()).toBe(new Date("2026-02-18T18:30:00+05:00").toISOString());
  });

  it("applies the sehri and iftar offsets", () => {
    expect(table.sehriEnds("2026-02-18")).toBe("2026-02-18T05:20:00+05:00");
    expect(table.iftar("2026-02-18")).toBe("2026-02-18T18:32:00+05:00");
  });
});

describe("sehriIftar", () => {
  it("returns sehri and iftar during Ramadan", () => {
    expect(sehriIftar(table, "2026-02-18", hijri(9))).toEqual({
      sehriEnds: "2026-02-18T05:20:00+05:00",
      iftar: "2026-02-18T18:32:00+05:00",
    });
  });

  it("returns nothing outside Ramadan", () => {
    expect(sehriIftar(table, "2026-02-18", hijri(8))).toBeUndefined();
  });
});
