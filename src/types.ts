/**
 * Shared types for the Hijri calendar and prayer times dataset.
 *
 * The JSON shapes here are the real contract: they are what GitHub Pages
 * serves and what the client library reads. Keep them stable and additive.
 */

/** Confidence attached to every published Hijri date. */
export type Confidence = "confirmed" | "estimated" | "predicted" | "unconfirmed";

/** Civil (Gregorian) date as `YYYY-MM-DD`. */
export type GregorianDate = string;

/** Hijri date as `YYYY-MM-DD`. */
export type HijriDateString = string;

/** A Hijri calendar date. Months are 1-12, days 1-30. */
export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

/** Local prayer time, ISO 8601 with the Pakistan offset, e.g. `2025-03-01T05:12:00+05:00`. */
export type LocalDateTime = string;

export interface HijriMonthOverride {
  /** Gregorian date of the 1st of the Hijri month, `YYYY-MM-DD`. */
  date: GregorianDate;
  /** One or more public source URLs. Required for auditability. */
  sources: string[];
}

/**
 * `data/hijri/overrides.json` — the human-edited record of confirmed month
 * starts. We store confirmed start dates rather than offsets, so a single
 * correction stays local instead of cascading through later months.
 */
export interface OverridesFile {
  /** Optional JSON-schema reference carried for editor support. */
  $schema?: string | undefined;
  /** Earliest Gregorian date the confirmed record covers, or null when empty. */
  coverage_start: GregorianDate | null;
  /** Keyed by the Hijri 1st, e.g. `"1447-09-01"`. */
  months: Record<HijriDateString, HijriMonthOverride>;
}

export interface MonthName {
  en: string;
  ur: string;
}

/** A single Gregorian day resolved to a Hijri date. */
export interface HijriDayEntry {
  /** Hijri date `YYYY-MM-DD`. */
  hijri: HijriDateString;
  year: number;
  month: number;
  day: number;
  month_name: MonthName;
  confidence: Confidence;
  /** Present when confidence is `confirmed`. */
  sources?: string[];
}

/** `data/hijri/calendar/<hijriYear>.json` — Gregorian date -> Hijri date. */
export interface CalendarFile {
  hijri_year: number;
  coverage_start: GregorianDate | null;
  generated_at: string;
  baseline: string;
  /** Keyed by Gregorian date `YYYY-MM-DD`. */
  days: Record<GregorianDate, HijriDayEntry>;
}

/** `data/hijri/index.json` — describes which years and coverage are available. */
export interface CalendarIndex {
  coverage_start: GregorianDate | null;
  generated_at: string;
  baseline: string;
  hijri_years: number[];
  /** Count of days published as `confirmed`. */
  confirmed_days: number;
}

export interface City {
  id: string;
  name: string;
  province: string;
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
}

export type ProfileId = "sunni_hanafi" | "sunni_asr1" | "shia_jafari";

export type MaghribRule = { type: "sunset" } | { type: "angle"; value: number };

export interface PrayerAdjustments {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

/** Calculation parameters for a sect/school profile. See proposal section 7.2. */
export interface PrayerProfile {
  id: ProfileId;
  label: string;
  /** Fajr twilight angle in degrees below the horizon. */
  fajrAngle: number;
  /** Isha twilight angle in degrees below the horizon. */
  ishaAngle: number;
  /** Asr shadow factor: 1 (earlier) or 2 (Hanafi). */
  asrFactor: 1 | 2;
  maghrib: MaghribRule;
  /** Minutes subtracted from Fajr to end sehri. Negative means later, i.e. less precaution. */
  sehriOffsetMin: number;
  /** Minutes added to Maghrib for iftar. */
  iftarOffsetMin: number;
  adjustMin: PrayerAdjustments;
}

export interface PrayerTimes {
  fajr: LocalDateTime;
  sunrise: LocalDateTime;
  dhuhr: LocalDateTime;
  asr: LocalDateTime;
  maghrib: LocalDateTime;
  isha: LocalDateTime;
}

export interface PrayerDay {
  date: GregorianDate;
  times: PrayerTimes;
}

/** `data/prayer/<city>/<profile>/<year>.json`. */
export interface PrayerFile {
  city: string;
  city_name: string;
  province: string;
  profile: ProfileId;
  profile_label: string;
  year: number;
  timezone: string;
  generated_at: string;
  disclaimer: string;
  /** Minutes added to Fajr for the end of sehri. Negative is earlier (precaution). */
  sehri_offset_min: number;
  /** Minutes added to Maghrib for iftar. */
  iftar_offset_min: number;
  /** Keyed by Gregorian date `YYYY-MM-DD`. */
  days: Record<GregorianDate, PrayerDay>;
}

/** A resolved Hijri date returned to client applications. */
export interface HijriResult {
  gregorian: GregorianDate;
  hijri: HijriDateString;
  year: number;
  month: number;
  day: number;
  monthName: MonthName;
  confidence: Confidence;
  sources?: string[];
  coverageStart: GregorianDate | null;
  /** Whether the Maghrib-based convention was applied. */
  afterMaghrib: boolean;
}

/** Sehri/Iftar pair, returned only during Ramadan. See proposal section 7.5. */
export interface SehriIftar {
  sehriEnds: LocalDateTime;
  iftar: LocalDateTime;
}
