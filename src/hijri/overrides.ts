import { readFileSync } from "node:fs";
import type { HijriDate, OverridesFile } from "../types.js";
import { hijriKey, isValidDateString } from "../dates.js";
import { OVERRIDES_FILE } from "../paths.js";

export interface ConfirmedMonth {
  hijri: HijriDate;
  hijriKey: string;
  /** Gregorian date of the 1st. */
  gregorian: string;
  sources: string[];
}

export interface NormalizedOverrides {
  coverageStart: string | null;
  /** Confirmed month starts, sorted ascending by Gregorian date. */
  months: ConfirmedMonth[];
}

export class OverridesValidationError extends Error {
  override name = "OverridesValidationError";
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseHijriKey(key: string, context: string): HijriDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) {
    throw new OverridesValidationError(
      `${context}: key "${key}" must be a Hijri date in YYYY-MM-DD form`,
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 30) {
    throw new OverridesValidationError(
      `${context}: "${key}" is not a valid Hijri date (month 1-12, day 1-30)`,
    );
  }
  return { year, month, day };
}

/**
 * Validate raw JSON against the overrides contract. Every entry needs at least
 * one source URL so the record stays auditable (proposal section 5.1).
 */
export function parseOverrides(input: unknown): NormalizedOverrides {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new OverridesValidationError("overrides must be a JSON object");
  }
  const file = input as Partial<OverridesFile>;

  const coverageStart = file.coverage_start ?? null;
  if (coverageStart !== null && (typeof coverageStart !== "string" || !isValidDateString(coverageStart))) {
    throw new OverridesValidationError(
      `coverage_start must be null or a YYYY-MM-DD date, got ${JSON.stringify(coverageStart)}`,
    );
  }

  if (file.months === undefined || typeof file.months !== "object" || file.months === null || Array.isArray(file.months)) {
    throw new OverridesValidationError("months must be an object keyed by Hijri date");
  }

  const months: ConfirmedMonth[] = [];
  const seenGregorian = new Map<string, string>();

  for (const [key, value] of Object.entries(file.months)) {
    const context = `months["${key}"]`;
    if (typeof value !== "object" || value === null) {
      throw new OverridesValidationError(`${context} must be an object`);
    }
    const entry = value as { date?: unknown; sources?: unknown };

    if (typeof entry.date !== "string" || !isValidDateString(entry.date)) {
      throw new OverridesValidationError(`${context}.date must be a YYYY-MM-DD date`);
    }
    if (!Array.isArray(entry.sources) || entry.sources.length === 0) {
      throw new OverridesValidationError(`${context}.sources must list at least one source URL`);
    }
    const sources: string[] = [];
    for (const source of entry.sources) {
      if (typeof source !== "string" || !isUrl(source)) {
        throw new OverridesValidationError(`${context}.sources contains a non-URL value: ${JSON.stringify(source)}`);
      }
      sources.push(source);
    }

    const hijri = parseHijriKey(key, context);

    const previousKey = seenGregorian.get(entry.date);
    if (previousKey !== undefined) {
      throw new OverridesValidationError(
        `${context}.date ${entry.date} is already used by ${previousKey}; two months cannot start on the same day`,
      );
    }
    seenGregorian.set(entry.date, key);

    months.push({ hijri, hijriKey: hijriKey(hijri), gregorian: entry.date, sources });
  }

  months.sort((a, b) => (a.gregorian < b.gregorian ? -1 : a.gregorian > b.gregorian ? 1 : 0));

  return { coverageStart, months };
}

export function loadOverrides(path: string = OVERRIDES_FILE): NormalizedOverrides {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    throw new OverridesValidationError(`Could not read overrides at ${path}: ${(error as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new OverridesValidationError(`Overrides at ${path} is not valid JSON: ${(error as Error).message}`);
  }
  return parseOverrides(parsed);
}
