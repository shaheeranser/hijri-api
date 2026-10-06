/**
 * Public package surface: the reference client library and the data contract
 * types. Generators and the watcher are build tooling and are not exported.
 */
export type * from "./types.js";
export { HijriCalendar, hijriDate, OutOfRangeError, type HijriDateOptions } from "./client/calendar.js";
export { PrayerTable, sehriIftar } from "./client/prayer.js";
export { HIJRI_MONTHS, RAMADAN_MONTH, monthName, isRamadan, nextHijriMonth } from "./hijri/months.js";
