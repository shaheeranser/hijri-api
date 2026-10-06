/**
 * Candidate month starts and the date gate for polling. The next month begins
 * either 29 or 30 days after the last confirmed start, so there are only ever
 * two candidates (proposal sections 6.1 and 6.4).
 */
import { DateTime } from "luxon";
import { addDays, todayInPakistan } from "../dates.js";

export interface MonthCandidate {
  /** Gregorian date `YYYY-MM-DD`. */
  date: string;
  /** English weekday name, e.g. "Monday". */
  weekday: string;
  /** Urdu weekday name, e.g. "پیر". */
  weekdayUr: string;
}

export interface CandidatePair {
  /** The 29th day of the current month, whose evening decides the outcome. */
  twentyNinth: string;
  candidates: [MonthCandidate, MonthCandidate];
}

const URDU_WEEKDAYS: Record<number, string> = {
  1: "پیر",
  2: "منگل",
  3: "بدھ",
  4: "جمعرات",
  5: "جمعہ",
  6: "ہفتہ",
  7: "اتوار",
};

function candidate(lastStart: string, offset: number, timezone: string): MonthCandidate {
  const date = addDays(lastStart, offset);
  const dt = DateTime.fromISO(date, { zone: "utc" }).setZone(timezone);
  return {
    date,
    weekday: dt.weekdayLong ?? "",
    weekdayUr: URDU_WEEKDAYS[dt.weekday] ?? "",
  };
}

/** The two dates the new month could begin on, given the last confirmed start. */
export function buildCandidates(lastStart: string, timezone: string): CandidatePair {
  return {
    twentyNinth: addDays(lastStart, 28),
    candidates: [candidate(lastStart, 29, timezone), candidate(lastStart, 30, timezone)],
  };
}

/**
 * True once we are inside the window where the committee can announce: from
 * Maghrib on the 29th until the start of what would be the 31st day.
 */
export function isPollingWindow(lastStart: string, now: Date, maghrib: Date): boolean {
  const day29 = addDays(lastStart, 28);
  const day31 = addDays(lastStart, 30);
  const civil = todayInPakistan(now);
  if (civil < day29 || civil >= day31) return false;
  if (civil === day29 && now.getTime() < maghrib.getTime()) return false;
  return true;
}
