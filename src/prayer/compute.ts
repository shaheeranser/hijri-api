/**
 * Compute one day of prayer times for a city and profile using adhan.
 */
import { CalculationParameters, Coordinates, Madhab, PrayerTimes } from "adhan";
import { DateTime } from "luxon";
import type { City, LocalDateTime, PrayerDay, PrayerProfile } from "../types.js";

function parseDateParts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined || Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    throw new Error(`Invalid date: ${date}`);
  }
  return { year, month, day };
}

function toLocalIso(instant: Date, timezone: string): LocalDateTime {
  return DateTime.fromJSDate(instant, { zone: "utc" })
    .setZone(timezone)
    .toISO({ suppressMilliseconds: true }) as string;
}

export function computeDay(city: City, profile: PrayerProfile, date: string): PrayerDay {
  const { year, month, day } = parseDateParts(date);
  // adhan reads the Date's LOCAL date components. Using local noon of the
  // target date keeps generation independent of the machine's timezone.
  const localNoon = new Date(year, month - 1, day, 12, 0, 0);

  const params = new CalculationParameters(
    null,
    profile.fajrAngle,
    profile.ishaAngle,
    0,
    profile.maghrib.type === "angle" ? profile.maghrib.value : 0,
  );
  params.madhab = profile.asrFactor === 2 ? Madhab.Hanafi : Madhab.Shafi;
  params.adjustments = { ...profile.adjustMin };

  const times = new PrayerTimes(new Coordinates(city.latitude, city.longitude), localNoon, params);

  return {
    date,
    times: {
      fajr: toLocalIso(times.fajr, city.timezone),
      sunrise: toLocalIso(times.sunrise, city.timezone),
      dhuhr: toLocalIso(times.dhuhr, city.timezone),
      asr: toLocalIso(times.asr, city.timezone),
      maghrib: toLocalIso(times.maghrib, city.timezone),
      isha: toLocalIso(times.isha, city.timezone),
    },
  };
}
