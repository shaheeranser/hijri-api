/**
 * Client-side Hijri dataset: load published calendar files, look up a day, and
 * resolve an instant to a Hijri date with the Maghrib-based rollover.
 */
import type { CalendarFile, GregorianDate, HijriDayEntry, HijriResult } from "../types.js";
import { addDays, todayInPakistan } from "../dates.js";

export class OutOfRangeError extends Error {
  override name = "OutOfRangeError";
  constructor(
    readonly gregorian: GregorianDate,
    readonly coverageStart: GregorianDate | null,
  ) {
    super(
      coverageStart === null
        ? `No calendar data covers ${gregorian}`
        : `No calendar data covers ${gregorian} (coverage starts ${coverageStart}; fetch newer data)`,
    );
  }
}

export class HijriCalendar {
  readonly coverageStart: GregorianDate | null;
  private readonly days: Map<GregorianDate, HijriDayEntry>;

  constructor(days: Map<GregorianDate, HijriDayEntry>, coverageStart: GregorianDate | null = null) {
    this.days = days;
    this.coverageStart = coverageStart;
  }

  /** Merge one or more generated calendar files into a single lookup table. */
  static fromFiles(files: CalendarFile[]): HijriCalendar {
    const days = new Map<GregorianDate, HijriDayEntry>();
    let coverageStart: GregorianDate | null = null;
    for (const file of files) {
      if (coverageStart === null && file.coverage_start !== null) coverageStart = file.coverage_start;
      for (const [date, entry] of Object.entries(file.days)) days.set(date, entry);
    }
    return new HijriCalendar(days, coverageStart);
  }

  static fromJSON(input: CalendarFile | CalendarFile[]): HijriCalendar {
    return HijriCalendar.fromFiles(Array.isArray(input) ? input : [input]);
  }

  get(gregorian: GregorianDate): HijriDayEntry | undefined {
    return this.days.get(gregorian);
  }

  has(gregorian: GregorianDate): boolean {
    return this.days.has(gregorian);
  }

  get size(): number {
    return this.days.size;
  }
}

export interface HijriDateOptions {
  calendar: HijriCalendar;
  /**
   * Return the Maghrib-based date instead of the midnight-based one. Requires
   * `maghrib` for the civil day.
   */
  afterMaghrib?: boolean | undefined;
  /** Maghrib instant for the civil day being resolved. */
  maghrib?: Date | undefined;
}

/**
 * Resolve an instant to a Hijri date. The default convention is midnight-based;
 * pass `afterMaghrib` with that day's Maghrib to get the Islamic day. A missing
 * date is reported as an OutOfRangeError rather than guessed.
 */
export function hijriDate(now: Date, options: HijriDateOptions): HijriResult {
  const { calendar, afterMaghrib = false, maghrib } = options;
  if (afterMaghrib && maghrib === undefined) {
    throw new Error("afterMaghrib requires the maghrib instant for the civil day");
  }
  const rolled = afterMaghrib && maghrib !== undefined && now.getTime() >= maghrib.getTime();
  const gregorian = rolled ? addDays(todayInPakistan(now), 1) : todayInPakistan(now);

  const entry = calendar.get(gregorian);
  if (entry === undefined) throw new OutOfRangeError(gregorian, calendar.coverageStart);

  const result: HijriResult = {
    gregorian,
    hijri: entry.hijri,
    year: entry.year,
    month: entry.month,
    day: entry.day,
    monthName: entry.month_name,
    confidence: entry.confidence,
    coverageStart: calendar.coverageStart,
    afterMaghrib: rolled,
  };
  return entry.sources === undefined ? result : { ...result, sources: entry.sources };
}
