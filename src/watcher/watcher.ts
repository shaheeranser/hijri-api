/**
 * Watch the 29th-evening announcement: gate on the polling window, fetch
 * sources, require two independent publishers to agree, then propose an update.
 * The watcher never writes; a human merges the pull request it drives.
 */
import type { NormalizedOverrides } from "../hijri/overrides.js";
import { todayInPakistan } from "../dates.js";
import { buildCandidates, isPollingWindow, type CandidatePair, type MonthCandidate } from "./candidates.js";
import {
  DEFAULT_SOURCES,
  fetchArticles,
  type Article,
  type FetchLike,
  type SourceConfig,
  type SourceError,
} from "./sources.js";
import { extractAnnouncedStart, type Extraction } from "./extract.js";
import { buildProposal, countPublishers, type Proposal } from "./proposal.js";

export interface WatcherOptions {
  overrides: NormalizedOverrides;
  /** Karachi Maghrib instant for a civil day, used for the gate. */
  maghribFor: (gregorian: string) => Date | undefined;
  now?: Date | undefined;
  sources?: SourceConfig[] | undefined;
  fetchImpl?: FetchLike | undefined;
  timezone?: string | undefined;
  /** Minimum independent publishers that must agree. Default 2. */
  requiredPublishers?: number | undefined;
}

export type WatcherOutcome =
  | { status: "no-baseline"; reason: string }
  | { status: "not-due"; reason: string; twentyNinth: string }
  | { status: "fetch-failed"; errors: SourceError[] }
  | { status: "no-announcement"; candidates: MonthCandidate[]; articlesChecked: number; errors: SourceError[] }
  | { status: "proposed"; proposal: Proposal };

export interface Agreement {
  article: Article;
  extraction: Extraction;
}

function groupAgreements(articles: Article[], pair: CandidatePair, now: Date): Agreement[] {
  const agreements: Agreement[] = [];
  for (const article of articles) {
    const extraction = extractAnnouncedStart(article, pair.candidates, now);
    if (extraction !== undefined) agreements.push({ article, extraction });
  }
  return agreements;
}

export async function runWatcher(options: WatcherOptions): Promise<WatcherOutcome> {
  const now = options.now ?? new Date();
  const timezone = options.timezone ?? "Asia/Karachi";
  const requiredPublishers = options.requiredPublishers ?? 2;
  const sources = options.sources ?? DEFAULT_SOURCES;
  const fetchImpl = options.fetchImpl ?? fetch;

  const last = options.overrides.months[options.overrides.months.length - 1];
  if (last === undefined) {
    return { status: "no-baseline", reason: "no confirmed month start to measure from" };
  }

  const pair = buildCandidates(last.gregorian, timezone);
  const maghrib = options.maghribFor(todayInPakistan(now));
  if (maghrib === undefined) {
    return { status: "not-due", reason: "no Maghrib available for today", twentyNinth: pair.twentyNinth };
  }
  if (!isPollingWindow(last.gregorian, now, maghrib)) {
    return { status: "not-due", reason: "outside the 29th-evening polling window", twentyNinth: pair.twentyNinth };
  }

  const { articles, errors } = await fetchArticles(sources, fetchImpl);
  if (articles.length === 0 && errors.length > 0) {
    return { status: "fetch-failed", errors };
  }

  const agreements = groupAgreements(articles, pair, now);
  for (const candidate of pair.candidates) {
    const agreeing = agreements.filter((agreement) => agreement.extraction.date === candidate.date);
    if (countPublishers(agreeing) >= requiredPublishers) {
      return {
        status: "proposed",
        proposal: buildProposal({
          lastConfirmed: last.hijri,
          gregorian: candidate.date,
          candidates: pair.candidates,
          agreements: agreeing,
          detectedAt: now.toISOString(),
        }),
      };
    }
  }

  return { status: "no-announcement", candidates: pair.candidates, articlesChecked: articles.length, errors };
}
