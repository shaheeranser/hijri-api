/**
 * Extract the announced start date from an announcement article and match it
 * against the two candidates. We look for the announced date rather than
 * interpreting "sighted / not sighted" (proposal section 6.2).
 */
import * as chrono from "chrono-node";
import { DateTime } from "luxon";
import { pad2 } from "../dates.js";
import type { Article } from "./sources.js";
import type { MonthCandidate } from "./candidates.js";

/** Committee context, so we ignore unrelated "moon"/"Eid" articles. */
const COMMITTEE = /(ruet|hilal|رویت|ہلال|روئیت|committee|کمیٹی)/i;
const START_PHRASE =
  /(will\s+(?:begin|start|commence)|begins?|starts?|commences?|first\s+day|1st\s+of|fall\s+on|announc|اعلان|شروع|پہلی\s+تاریخ|پہلا\s+روز|عید|eid)/i;
const NOT_SIGHTED = /(not\s+sighted|no\s+sighting|not\s+been\s+sighted|نظر\s*نہیں|دیکھا\s*نہیں)/i;
const SIGHTED = /(?:moon\s+)?sighted|نظر\s*آ\s*گیا|نظر\s*آئ/i;

export interface Extraction {
  date: string;
  evidence: string;
  strength: "strong" | "medium";
}

function matchByChrono(text: string, reference: Date, candidates: MonthCandidate[]): Extraction | undefined {
  const ref = DateTime.fromJSDate(reference, { zone: "utc" }).setZone("Asia/Karachi");
  const parsed = chrono.casual.parse(text, reference);
  for (const result of parsed) {
    const month = result.start.get("month");
    const day = result.start.get("day");
    if (month === null || day === null) continue;
    const year = result.start.get("year") ?? ref.year;
    const iso = `${year.toString().padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
    const candidate = candidates.find((item) => item.date === iso);
    if (candidate !== undefined) {
      return { date: candidate.date, evidence: `parsed date "${result.text}"`, strength: "strong" };
    }
  }
  return undefined;
}

function matchByWeekday(text: string, candidates: MonthCandidate[]): Extraction | undefined {
  for (const sentence of text.split(/[.!?\n۔]+/)) {
    if (!START_PHRASE.test(sentence)) continue;
    for (const candidate of candidates) {
      const names = [candidate.weekday, candidate.weekdayUr].filter((name) => name.length > 0);
      if (names.some((name) => sentence.includes(name))) {
        return { date: candidate.date, evidence: `weekday "${candidate.weekday}" near a start phrase`, strength: "medium" };
      }
    }
  }
  return undefined;
}

/**
 * Last resort for "sighted / not sighted" wording with no date or weekday. The
 * direction maps directly onto the candidates: a sighting on the 29th starts
 * the month after 29 days, a non-sighting after 30. Only trusted when the text
 * names the watched month, so a stale report about another month cannot match.
 */
function matchBySighting(text: string, candidates: MonthCandidate[], namesMonth: boolean): Extraction | undefined {
  if (!namesMonth) return undefined;
  const sightingCandidate = candidates[0];
  const noSightingCandidate = candidates[1];
  if (NOT_SIGHTED.test(text) && noSightingCandidate !== undefined) {
    return { date: noSightingCandidate.date, evidence: "moon not sighted → 30-day month", strength: "medium" };
  }
  if (SIGHTED.test(text) && sightingCandidate !== undefined) {
    return { date: sightingCandidate.date, evidence: "moon sighted → 29-day month", strength: "medium" };
  }
  return undefined;
}

/**
 * @param monthVariants Spellings of the month being watched. A match on any of
 *   them counts as context alongside the committee vocabulary, so headlines
 *   that name the month but never say "Ruet-e-Hilal" are still considered.
 */
function articleText(article: Article): string {
  return [article.title, article.summary].filter((part): part is string => typeof part === "string").join(". ");
}

/**
 * True when an article is *about* an announcement (committee or watched-month
 * context plus a start phrase) even if no candidate date could be extracted.
 * Used to report near misses so a silent run can be diagnosed.
 */
export function isRelevantAnnouncement(article: Article, monthVariants: readonly string[] = []): boolean {
  const text = articleText(article);
  const namesMonth = monthVariants.some((variant) => variant.length > 0 && text.includes(variant));
  return (COMMITTEE.test(text) || namesMonth) && START_PHRASE.test(text);
}

export function extractAnnouncedStart(
  article: Article,
  candidates: MonthCandidate[],
  reference: Date,
  monthVariants: readonly string[] = [],
): Extraction | undefined {
  const text = articleText(article);
  const namesMonth = monthVariants.some((variant) => variant.length > 0 && text.includes(variant));
  if (!COMMITTEE.test(text) && !namesMonth) return undefined;
  if (!START_PHRASE.test(text)) return undefined;

  const explicit = candidates.find((candidate) => text.includes(candidate.date));
  if (explicit !== undefined) {
    return { date: explicit.date, evidence: `explicit date ${explicit.date}`, strength: "strong" };
  }

  return (
    matchByChrono(text, reference, candidates) ??
    matchByWeekday(text, candidates) ??
    matchBySighting(text, candidates, namesMonth)
  );
}
