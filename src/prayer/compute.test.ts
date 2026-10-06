import { describe, expect, it } from "vitest";
import type { City } from "../types.js";
import { PROFILES } from "./profiles.js";
import { computeDay } from "./compute.js";

const karachi: City = {
  id: "karachi",
  name: "Karachi",
  province: "Sindh",
  latitude: 24.8607,
  longitude: 67.0011,
  elevation: 8,
  timezone: "Asia/Karachi",
};

describe("computeDay", () => {
  it("matches a known Karachi summer day", () => {
    const day = computeDay(karachi, PROFILES.sunni_hanafi, "2026-06-21");
    expect(day.times).toEqual({
      fajr: "2026-06-21T04:14:00+05:00",
      sunrise: "2026-06-21T05:43:00+05:00",
      dhuhr: "2026-06-21T12:34:00+05:00",
      asr: "2026-06-21T17:17:00+05:00",
      maghrib: "2026-06-21T19:24:00+05:00",
      isha: "2026-06-21T20:53:00+05:00",
    });
  });

  it("gives the Hanafi Asr later than the shadow-factor-1 Asr", () => {
    const hanafi = computeDay(karachi, PROFILES.sunni_hanafi, "2026-06-21");
    const earlier = computeDay(karachi, PROFILES.sunni_asr1, "2026-06-21");
    expect(hanafi.times.asr > earlier.times.asr).toBe(true);
  });

  it("gives Jafari Maghrib after sunset and a later Fajr than the 18-degree angle", () => {
    const hanafi = computeDay(karachi, PROFILES.sunni_hanafi, "2026-06-21");
    const jafari = computeDay(karachi, PROFILES.shia_jafari, "2026-06-21");
    expect(jafari.times.maghrib > hanafi.times.maghrib).toBe(true);
    expect(jafari.times.fajr > hanafi.times.fajr).toBe(true);
  });

  it("formats every time in the city timezone", () => {
    const day = computeDay(karachi, PROFILES.sunni_hanafi, "2026-01-15");
    for (const value of Object.values(day.times)) expect(value).toMatch(/\+05:00$/);
  });
});
