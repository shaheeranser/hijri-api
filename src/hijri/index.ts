/** Public surface of the Hijri calendar module. */
export { BASELINE_NAME, toHijri, hijriToGregorian, hijriYearStart, hijriYearSpan } from "./baseline.js";
export { HIJRI_MONTHS, RAMADAN_MONTH, monthName, isRamadan, nextHijriMonth } from "./months.js";
export {
  loadOverrides,
  parseOverrides,
  OverridesValidationError,
  type ConfirmedMonth,
  type NormalizedOverrides,
} from "./overrides.js";
export { buildTimeline, resolveDay, type ConfirmAnchor, type ResolveContext } from "./resolve.js";
export { buildCalendar, type BuildCalendarOptions, type CalendarBuildResult } from "./calendar.js";
