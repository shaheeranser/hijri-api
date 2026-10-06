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
  /(will\s+(?:begin|start|commence)|begins?|starts?|commences?|first\s+day|1st\s+of|announc|اعلان|شروع|پہلی\s+تاریخ|پہلا\s+روز|عید|eid)/i;

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

export function extractAnnouncedStart(
  article: Article,
  candidates: MonthCandidate[],
  reference: Date,
): Extraction | undefined {
  const text = [article.title, article.summary].filter((part): part is string => typeof part === "string").join(". ");
  if (!COMMITTEE.test(text)) return undefined;
  if (!START_PHRASE.test(text)) return undefined;

  const explicit = candidates.find((candidate) => text.includes(candidate.date));
  if (explicit !== undefined) {
    return { date: explicit.date, evidence: `explicit date ${explicit.date}`, strength: "strong" };
  }

  return matchByChrono(text, reference, candidates) ?? matchByWeekday(text, candidates);
}
