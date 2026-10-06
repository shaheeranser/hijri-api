/**
 * Assemble yearly Hijri calendar files and the calendar index from the
 * confirmed overrides plus the baseline.
 */
import type { CalendarFile, CalendarIndex, GregorianDate, HijriDayEntry } from "../types.js";
import { addDays, diffDays, todayInPakistan } from "../dates.js";
import { BASELINE_NAME, hijriYearSpan } from "./baseline.js";
import { buildTimeline, resolveDay, type ResolveContext } from "./resolve.js";
import type { NormalizedOverrides } from "./overrides.js";

export interface BuildCalendarOptions {
  /** Hijri years to emit. Should be consecutive. */
  hijriYears: number[];
  overrides: NormalizedOverrides;
  /** ISO timestamp stamped into the files. Injected for deterministic tests. */
  generatedAt?: string | undefined;
  /** Today in Pakistan, `YYYY-MM-DD`. Injected for deterministic tests. */
  today?: string | undefined;
}

export interface CalendarBuildResult {
  files: CalendarFile[];
  index: CalendarIndex;
}

function effectiveCoverageStart(overrides: NormalizedOverrides): string | null {
  if (overrides.coverageStart !== null) return overrides.coverageStart;
  return overrides.months[0]?.gregorian ?? null;
}

export function buildCalendar(options: BuildCalendarOptions): CalendarBuildResult {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const today = options.today ?? todayInPakistan();
  const coverageStart = effectiveCoverageStart(options.overrides);
  const context: ResolveContext = {
    timeline: buildTimeline(options.overrides.months),
    today,
  };

  const years = [...new Set(options.hijriYears)].sort((a, b) => a - b);
  const files: CalendarFile[] = [];
  let confirmedDays = 0;

  for (const hijriYear of years) {
    const { start, endExclusive } = hijriYearSpan(hijriYear);
    const days: Record<GregorianDate, HijriDayEntry> = {};
    const length = diffDays(start, endExclusive);
    for (let offset = 0; offset < length; offset += 1) {
      const gregorian = addDays(start, offset);
      const resolved = resolveDay(gregorian, context);
      days[gregorian] = resolved;
      if (resolved.confidence === "confirmed") confirmedDays += 1;
    }
    files.push({
      hijri_year: hijriYear,
      coverage_start: coverageStart,
      generated_at: generatedAt,
      baseline: BASELINE_NAME,
      days,
    });
  }

  return {
    files,
    index: {
      coverage_start: coverageStart,
      generated_at: generatedAt,
      baseline: BASELINE_NAME,
      hijri_years: years,
      confirmed_days: confirmedDays,
    },
  };
}
