/**
 * Resolve a Gregorian day to a Hijri date, preferring the confirmed override
 * record and falling back to the baseline. Owns the confidence policy.
 */
import type { Confidence, HijriDate, HijriDayEntry } from "../types.js";
import { addDays, diffDays, hijriKey } from "../dates.js";
import { monthName, nextHijriMonth } from "./months.js";
import { toHijri } from "./baseline.js";
import type { ConfirmedMonth } from "./overrides.js";

export interface ConfirmAnchor {
  month: ConfirmedMonth;
  /** Gregorian start of the next Hijri month when it is confirmed, else null. */
  nextConfirmedStart: string | null;
}

/** A month is at least 29 days, so its first 29 days are certain. */
const CERTAIN_DAYS = 29;

function isSameMonth(a: HijriDate, b: HijriDate): boolean {
  return a.year === b.year && a.month === b.month;
}

export function buildTimeline(months: ConfirmedMonth[]): ConfirmAnchor[] {
  return months.map((month, index) => {
    const next = months[index + 1];
    const followsOn = next !== undefined && isSameMonth(next.hijri, nextHijriMonth(month.hijri));
    return { month, nextConfirmedStart: followsOn ? next.gregorian : null };
  });
}

function entry(hijri: HijriDate, confidence: Confidence, sources?: string[]): HijriDayEntry {
  const base: HijriDayEntry = {
    hijri: hijriKey(hijri),
    year: hijri.year,
    month: hijri.month,
    day: hijri.day,
    month_name: monthName(hijri.month),
    confidence,
  };
  return sources === undefined ? base : { ...base, sources };
}

function createEntry(anchor: ConfirmAnchor, daysSinceStart: number): HijriDayEntry {
  const hijri: HijriDate = {
    year: anchor.month.hijri.year,
    month: anchor.month.hijri.month,
    day: anchor.month.hijri.day + daysSinceStart,
  };
  return entry(hijri, "confirmed", anchor.month.sources);
}

function latestAnchor(gregorian: string, timeline: ConfirmAnchor[]): ConfirmAnchor | null {
  let found: ConfirmAnchor | null = null;
  for (const anchor of timeline) {
    if (anchor.month.gregorian <= gregorian) found = anchor;
    else break;
  }
  return found;
}

export interface ResolveContext {
  timeline: ConfirmAnchor[];
  /** Today in Pakistan, `YYYY-MM-DD`. Dates on or after it are future. */
  today: string;
}

/**
 * Confidence rules (proposal section 5.2):
 * - confirmed: a verified start date covers this day.
 * - unconfirmed: on the projected last day of a month, where sighting decides
 *   whether a 30th day exists.
 * - predicted / estimated: baseline fallback for future / past days.
 */
export function resolveDay(gregorian: string, context: ResolveContext): HijriDayEntry {
  const anchor = latestAnchor(gregorian, context.timeline);
  if (anchor !== null) {
    const daysSinceStart = diffDays(anchor.month.gregorian, gregorian);
    if (anchor.nextConfirmedStart !== null) {
      // The latest anchor always precedes its confirmed successor, so this day
      // falls inside the current month.
      return createEntry(anchor, daysSinceStart);
    }
    if (daysSinceStart < CERTAIN_DAYS) return createEntry(anchor, daysSinceStart);
    if (daysSinceStart === CERTAIN_DAYS) {
      const day30 = createEntry(anchor, daysSinceStart);
      return { ...day30, confidence: "unconfirmed" };
    }
    // Past the anchored month with no confirmed successor: fall back to baseline.
  }

  const hijri = toHijri(gregorian);
  const isMonthEnd = toHijri(addDays(gregorian, 1)).day === 1 && hijri.day >= CERTAIN_DAYS;
  const future = gregorian >= context.today;
  const confidence: Confidence = isMonthEnd && future ? "unconfirmed" : future ? "predicted" : "estimated";
  return entry(hijri, confidence);
}
