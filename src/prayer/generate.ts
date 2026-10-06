/**
 * Assemble prayer time files for cities, profiles and Gregorian years.
 */
import type { City, GregorianDate, PrayerDay, PrayerFile, PrayerProfile } from "../types.js";
import { addDays, diffDays } from "../dates.js";
import { computeDay } from "./compute.js";

export const PRAYER_DISCLAIMER =
  "Calculated prayer times, not observed. For guidance only; always defer to your local mosque or imambargah.";

export interface BuildPrayerFileOptions {
  city: City;
  profile: PrayerProfile;
  year: number;
  generatedAt?: string | undefined;
}

export function buildPrayerFile(options: BuildPrayerFileOptions): PrayerFile {
  const { city, profile, year } = options;
  const start = `${year}-01-01`;
  const endExclusive = `${year + 1}-01-01`;
  const length = diffDays(start, endExclusive);

  const days: Record<GregorianDate, PrayerDay> = {};
  for (let offset = 0; offset < length; offset += 1) {
    const date = addDays(start, offset);
    days[date] = computeDay(city, profile, date);
  }

  return {
    city: city.id,
    city_name: city.name,
    province: city.province,
    profile: profile.id,
    profile_label: profile.label,
    year,
    timezone: city.timezone,
    generated_at: options.generatedAt ?? new Date().toISOString(),
    disclaimer: PRAYER_DISCLAIMER,
    sehri_offset_min: profile.sehriOffsetMin,
    iftar_offset_min: profile.iftarOffsetMin,
    days,
  };
}

export interface BuildPrayerFilesOptions {
  cities: City[];
  profiles: PrayerProfile[];
  /** Gregorian years to emit. */
  years: number[];
  generatedAt?: string | undefined;
}

export function buildPrayerFiles(options: BuildPrayerFilesOptions): PrayerFile[] {
  const files: PrayerFile[] = [];
  for (const city of options.cities) {
    for (const profile of options.profiles) {
      for (const year of options.years) {
        files.push(buildPrayerFile({ city, profile, year, generatedAt: options.generatedAt }));
      }
    }
  }
  return files;
}
