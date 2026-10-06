import { DateTime } from "luxon";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is a real `YYYY-MM-DD` calendar date. */
export function isValidDateString(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const dt = DateTime.fromISO(value, { zone: "utc" });
  return dt.isValid && dt.toISODate() === value;
}

/** Parse `YYYY-MM-DD` as a UTC midnight Luxon DateTime, or throw. */
export function toUtc(date: string): DateTime {
  const dt = DateTime.fromISO(date, { zone: "utc" }).startOf("day");
  if (!dt.isValid) throw new Error(`Invalid date string: ${date}`);
  return dt;
}

export function addDays(date: string, days: number): string {
  return toUtc(date).plus({ days }).toISODate() as string;
}

export function diffDays(from: string, to: string): number {
  return Math.round(toUtc(to).diff(toUtc(from), "days").days);
}

/** Today's date in Pakistan, as `YYYY-MM-DD`. */
export function todayInPakistan(now: Date = new Date()): string {
  return DateTime.fromJSDate(now, { zone: "utc" }).setZone("Asia/Karachi").toISODate() as string;
}

export function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

/** Build a `YYYY-MM-DD` string without timezone round-tripping. */
export function hijriKey(date: { year: number; month: number; day: number }): string {
  return `${date.year.toString().padStart(4, "0")}-${pad2(date.month)}-${pad2(date.day)}`;
}
