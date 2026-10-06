/**
 * Client-side prayer data lookup and the sehri/iftar gate. Sehri and iftar are
 * surfaced only during Ramadan, which is the single point of coupling between
 * the Hijri and prayer modules (proposal section 7.5).
 */
import { DateTime } from "luxon";
import type { GregorianDate, LocalDateTime, PrayerDay, PrayerFile, SehriIftar } from "../types.js";
import { isRamadan } from "../hijri/months.js";

export class PrayerTable {
  constructor(private readonly file: PrayerFile) {}

  static fromJSON(file: PrayerFile): PrayerTable {
    return new PrayerTable(file);
  }

  get metadata(): PrayerFile {
    return this.file;
  }

  day(gregorian: GregorianDate): PrayerDay | undefined {
    return this.file.days[gregorian];
  }

  /** The Maghrib instant for a day, for the client's after-maghrib rollover. */
  maghrib(gregorian: GregorianDate): Date | undefined {
    const times = this.day(gregorian)?.times;
    if (times === undefined) return undefined;
    const parsed = DateTime.fromISO(times.maghrib, { setZone: true });
    return parsed.isValid ? parsed.toJSDate() : undefined;
  }

  private offset(instant: LocalDateTime, minutes: number): LocalDateTime {
    const parsed = DateTime.fromISO(instant, { setZone: true });
    if (!parsed.isValid) throw new Error(`Invalid prayer time: ${instant}`);
    return parsed.plus({ minutes }).toISO({ suppressMilliseconds: true }) as string;
  }

  sehriEnds(gregorian: GregorianDate): LocalDateTime | undefined {
    const times = this.day(gregorian)?.times;
    if (times === undefined) return undefined;
    return this.offset(times.fajr, this.file.sehri_offset_min);
  }

  iftar(gregorian: GregorianDate): LocalDateTime | undefined {
    const times = this.day(gregorian)?.times;
    if (times === undefined) return undefined;
    return this.offset(times.maghrib, this.file.iftar_offset_min);
  }
}

/**
 * Sehri and iftar for a day, or undefined outside Ramadan. Takes the resolved
 * month so a HijriResult or a HijriDayEntry both work.
 */
export function sehriIftar(
  table: PrayerTable,
  gregorian: GregorianDate,
  hijri: { month: number },
): SehriIftar | undefined {
  if (!isRamadan(hijri.month)) return undefined;
  const sehriEnds = table.sehriEnds(gregorian);
  const iftar = table.iftar(gregorian);
  if (sehriEnds === undefined || iftar === undefined) return undefined;
  return { sehriEnds, iftar };
}
