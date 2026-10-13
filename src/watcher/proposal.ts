/**
 * Turn an agreed announcement into a proposed overrides entry and the pull
 * request description a human reviews before anything is published.
 */
import type { HijriDate, OverridesFile } from "../types.js";
import { hijriKey } from "../dates.js";
import { monthName, nextHijriMonth } from "../hijri/months.js";
import type { MonthCandidate } from "./candidates.js";
import type { Article } from "./sources.js";
import type { Extraction } from "./extract.js";

export interface Evidence {
  publisher: string;
  title: string;
  link: string;
  evidence: string;
  strength: Extraction["strength"];
}

export interface Proposal {
  hijriKey: string;
  hijri: HijriDate;
  gregorian: string;
  sources: string[];
  evidence: Evidence[];
  candidates: MonthCandidate[];
  detectedAt: string;
}

export interface BuildProposalOptions {
  lastConfirmed: HijriDate;
  gregorian: string;
  candidates: MonthCandidate[];
  agreements: { article: Article; extraction: Extraction }[];
  detectedAt: string;
}

export function buildProposal(options: BuildProposalOptions): Proposal {
  const hijri = nextHijriMonth(options.lastConfirmed);
  return {
    hijriKey: hijriKey(hijri),
    hijri,
    gregorian: options.gregorian,
    sources: [...new Set(options.agreements.map((a) => a.article.link))],
    evidence: options.agreements.map((a) => ({
      publisher: a.article.publisher,
      title: a.article.title,
      link: a.article.link,
      evidence: a.extraction.evidence,
      strength: a.extraction.strength,
    })),
    candidates: options.candidates,
    detectedAt: options.detectedAt,
  };
}

/**
 * Google News exposes an outlet's display label in `<source>` but not its
 * domain, while direct feeds expose the hostname. Both forms map to one
 * canonical key so the same outlet cannot count as two independent sources.
 */
const PUBLISHER_ALIASES: Record<string, string> = {
  "associated press of pakistan": "app.com.pk",
  "app": "app.com.pk",
  "business recorder": "brecorder.com",
  "brecorder": "brecorder.com",
  "the news": "thenews.com.pk",
  "the news pakistan": "thenews.com.pk",
  "24 news hd": "24newshd.tv",
  "24newshd": "24newshd.tv",
  "dunya news": "dunyanews.tv",
  "geo news": "geo.tv",
  "geo": "geo.tv",
  "ary news": "arynews.tv",
  "samaa": "samaa.tv",
  "samaa tv": "samaa.tv",
  "the nation": "nation.com.pk",
  "the express tribune": "tribune.com.pk",
  "express tribune": "tribune.com.pk",
  "dawn": "dawn.com",
  "dawn news": "dawn.com",
  "bol news": "bolnews.com",
  "daily pakistan": "dailypakistan.com.pk",
  "pakistan observer": "pakobserver.net",
  "minute mirror": "minutemirror.com.pk",
  "pakistan today": "pakistantoday.com.pk",
  "pakistan connect": "thepakistanconnect.com",
  "khyber news": "khybernews.tv",
};

const MULTI_LABEL_SUFFIXES = new Set(["com.pk", "org.pk", "net.pk", "gov.pk", "edu.pk", "co.uk", "com.au", "co.in"]);

function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  return MULTI_LABEL_SUFFIXES.has(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
}

function publisherLabel(publisher: string): string {
  return publisher.replace(/^\s*\|\s*/, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Stable identity for a publisher, independent of whether it came via Google News or a direct feed. */
export function canonicalPublisher(publisher: string): string {
  const label = publisherLabel(publisher);
  const alias = PUBLISHER_ALIASES[label];
  if (alias !== undefined) return alias;
  if (label !== "" && !label.includes(" ") && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(label)) {
    return registrableDomain(label);
  }
  return label;
}

/** Number of distinct publishers behind a set of agreements. */
export function countPublishers(agreements: { article: Article }[]): number {
  return new Set(agreements.map((a) => canonicalPublisher(a.article.publisher))).size;
}

export function applyProposal(raw: OverridesFile, proposal: Proposal): OverridesFile {
  const months: OverridesFile["months"] = {
    ...raw.months,
    [proposal.hijriKey]: { date: proposal.gregorian, sources: proposal.sources },
  };
  const dates = [...Object.values(months).map((entry) => entry.date), raw.coverage_start].filter(
    (date): date is string => typeof date === "string",
  );
  const coverageStart = dates.length > 0 ? dates.reduce((min, date) => (date < min ? date : min)) : null;
  return { ...raw, coverage_start: coverageStart, months };
}

export function renderPullRequestBody(proposal: Proposal): string {
  const name = monthName(proposal.hijri.month);
  const candidates = proposal.candidates
    .map((candidate) => `- ${candidate.date} (${candidate.weekday} / ${candidate.weekdayUr})`)
    .join("\n");
  const evidence = proposal.evidence
    .map((item) => `- **${item.publisher}** (${item.strength}): [${item.title}](${item.link}) — _${item.evidence}_`)
    .join("\n");

  return `## Proposed Hijri month start: ${name.en} ${proposal.hijri.year}

The watcher detected agreement across independent sources that **1 ${name.en} ${proposal.hijri.year} (${name.ur})** begins on **${proposal.gregorian}**.

### Candidate dates
${candidates}

### Evidence
${evidence}

### Before merging
- [ ] The announced date matches ${proposal.gregorian}.
- [ ] The sources are the Central Ruet-e-Hilal Committee, not a zonal committee.
- [ ] The month name is correct.

Merging this updates \`data/hijri/overrides.json\` for \`${proposal.hijriKey}\` and triggers regeneration and deployment.

<sub>Detected ${proposal.detectedAt}.</sub>
`;
}
