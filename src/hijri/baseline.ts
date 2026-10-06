import { DateTime } from "luxon";
import type { HijriDate } from "../types.js";
import { addDays, toUtc } from "../dates.js";

/**
 * Baseline Hijri conversion.
 *
 * We use the Umm al-Qura calendar as shipped with Node's full ICU data. It is
 * only ever a fallback: Pakistan starts most months by sighting, so the
 * baseline is always served as `estimated` or `predicted`, never `confirmed`.
 * See proposal section 5.3.
 */
export const BASELINE_NAME = "islamic-umalqura (Intl)";

const HIJRI_FORMAT = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

/** 1 Muharram 1 AH in the proleptic Gregorian calendar. */
const HIJRI_EPOCH = DateTime.utc(622, 7, 19);
const MEAN_YEAR_DAYS = 354.367;
const MEAN_MONTH_DAYS = 29.53059;

function parseHijriParts(parts: Intl.DateTimeFormatPart[]): HijriDate {
  let year = 0;
  let month = 0;
  let day = 0;
  for (const part of parts) {
    if (part.type === "year") year = Number.parseInt(part.value, 10);
    else if (part.type === "month") month = Number.parseInt(part.value, 10);
    else if (part.type === "day") day = Number.parseInt(part.value, 10);
  }
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error(`Could not parse Umm al-Qura output: ${JSON.stringify(parts)}`);
  }
  return { year, month, day };
}

/** Convert a Gregorian `YYYY-MM-DD` to its baseline Hijri date. */
export function toHijri(gregorian: string): HijriDate {
  const jsDate = toUtc(gregorian).toJSDate();
  return parseHijriParts(HIJRI_FORMAT.formatToParts(jsDate));
}

function estimateGregorian(hijri: HijriDate): string {
  const monthsSinceEpoch = (hijri.year - 1) * 12 + (hijri.month - 1);
  const days = Math.round(monthsSinceEpoch * MEAN_MONTH_DAYS + (hijri.day - 1));
  return HIJRI_EPOCH.plus({ days }).toISODate() as string;
}

/**
 * Invert the baseline: find the Gregorian date for a Hijri date by scanning
 * around an arithmetic estimate. Used by tests and tooling, not the hot path.
 */
export function hijriToGregorian(hijri: HijriDate): string {
  const estimate = estimateGregorian(hijri);
  for (let offset = -45; offset <= 45; offset += 1) {
    const candidate = addDays(estimate, offset);
    const got = toHijri(candidate);
    if (got.year === hijri.year && got.month === hijri.month && got.day === hijri.day) {
      return candidate;
    }
  }
  throw new Error(`Could not invert baseline Hijri date ${hijri.year}-${hijri.month}-${hijri.day}`);
}

/** Gregorian date of 1 Muharram for a Hijri year, per the baseline. */
export function hijriYearStart(hijriYear: number): string {
  return hijriToGregorian({ year: hijriYear, month: 1, day: 1 });
}

/** A Hijri year's Gregorian span, `[start, endExclusive)`. */
export function hijriYearSpan(hijriYear: number): { start: string; endExclusive: string } {
  return {
    start: hijriYearStart(hijriYear),
    endExclusive: hijriYearStart(hijriYear + 1),
  };
}
