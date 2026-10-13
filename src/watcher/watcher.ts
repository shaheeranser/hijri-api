/**
 * Watch the 29th-evening announcement: gate on the polling window, fetch
 * sources, require two independent publishers to agree, then propose an update.
 * The watcher never writes; a human merges the pull request it drives.
 */
import type { NormalizedOverrides } from "../hijri/overrides.js";
import type { HijriDate } from "../types.js";
import { nextHijriMonth, monthNameVariants } from "../hijri/months.js";
import { todayInPakistan } from "../dates.js";
import { buildCandidates, isPollingWindow, type CandidatePair, type MonthCandidate } from "./candidates.js";
import {
  buildSources,
  fetchArticles,
  type Article,
  type FetchLike,
  type SourceConfig,
  type SourceError,
} from "./sources.js";
import { extractAnnouncedStart, isRelevantAnnouncement, type Extraction } from "./extract.js";
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

/** A publisher whose article matched a candidate but did not reach agreement. */
export interface Sighting {
  date: string;
  publisher: string;
  title: string;
  link: string;
  evidence: string;
  strength: Extraction["strength"];
}

/** An announcement-shaped article from which no candidate date could be read. */
export interface NearMiss {
  publisher: string;
  title: string;
  link: string;
}

export type WatcherOutcome =
  | { status: "no-baseline"; reason: string }
  | { status: "not-due"; reason: string; twentyNinth: string }
  | { status: "overdue"; latest: string; lastConfirmed: HijriDate; expected: HijriDate }
  | { status: "fetch-failed"; errors: SourceError[] }
  | {
      status: "no-announcement";
      candidates: MonthCandidate[];
      articlesChecked: number;
      articlesInWindow: number;
      errors: SourceError[];
      sightings: Sighting[];
      nearMisses: NearMiss[];
    }
  | { status: "proposed"; proposal: Proposal };

export interface Agreement {
  article: Article;
  extraction: Extraction;
}

const MAX_NEAR_MISSES = 25;

function groupAgreements(
  articles: Article[],
  pair: CandidatePair,
  now: Date,
  monthVariants: readonly string[],
): Agreement[] {
  const agreements: Agreement[] = [];
  for (const article of articles) {
    const extraction = extractAnnouncedStart(article, pair.candidates, now, monthVariants);
    if (extraction !== undefined) agreements.push({ article, extraction });
  }
  return agreements;
}

export async function runWatcher(options: WatcherOptions): Promise<WatcherOutcome> {
  const now = options.now ?? new Date();
  const timezone = options.timezone ?? "Asia/Karachi";
  const requiredPublishers = options.requiredPublishers ?? 2;
  const fetchImpl = options.fetchImpl ?? fetch;

  const last = options.overrides.months[options.overrides.months.length - 1];
  if (last === undefined) {
    return { status: "no-baseline", reason: "no confirmed month start to measure from" };
  }

  const nextMonth = nextHijriMonth(last.hijri).month;
  const sources = options.sources ?? buildSources(nextMonth);
  const monthVariants = monthNameVariants(nextMonth);

  const pair = buildCandidates(last.gregorian, timezone);
  const maghrib = options.maghribFor(todayInPakistan(now));
  if (maghrib === undefined) {
    return { status: "not-due", reason: "no Maghrib available for today", twentyNinth: pair.twentyNinth };
  }
  if (!isPollingWindow(last.gregorian, now, maghrib)) {
    const latest = pair.candidates[1]?.date;
    if (latest !== undefined && todayInPakistan(now) >= latest) {
      return { status: "overdue", latest, lastConfirmed: last.hijri, expected: nextHijriMonth(last.hijri) };
    }
    return { status: "not-due", reason: "outside the 29th-evening polling window", twentyNinth: pair.twentyNinth };
  }

  const { articles, errors } = await fetchArticles(sources, fetchImpl);
  if (articles.length === 0 && errors.length > 0) {
    return { status: "fetch-failed", errors };
  }

  // Ranked feeds can surface old announcements; only the days around the 29th
  // can carry the decision we are waiting for.
  const since = new Date(`${pair.twentyNinth}T00:00:00+05:00`).getTime();
  const inWindow = articles.filter(
    (article) => article.publishedAt === undefined || Date.parse(article.publishedAt) >= since,
  );

  const agreements = groupAgreements(inWindow, pair, now, monthVariants);
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

  const matchedLinks = new Set(agreements.map((agreement) => agreement.article.link));
  const sightings: Sighting[] = agreements.map((agreement) => ({
    date: agreement.extraction.date,
    publisher: agreement.article.publisher,
    title: agreement.article.title,
    link: agreement.article.link,
    evidence: agreement.extraction.evidence,
    strength: agreement.extraction.strength,
  }));
  const nearMisses: NearMiss[] = inWindow
    .filter(
      (article) =>
        !matchedLinks.has(article.link) && isRelevantAnnouncement(article, monthVariants),
    )
    .slice(0, MAX_NEAR_MISSES)
    .map((article) => ({ publisher: article.publisher, title: article.title, link: article.link }));

  return {
    status: "no-announcement",
    candidates: pair.candidates,
    articlesChecked: articles.length,
    articlesInWindow: inWindow.length,
    errors,
    sightings,
    nearMisses,
  };
}
