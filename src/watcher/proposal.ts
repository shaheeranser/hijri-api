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

/** Number of distinct publishers behind a set of agreements. */
export function countPublishers(agreements: { article: Article }[]): number {
  return new Set(agreements.map((a) => a.article.publisher)).size;
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
