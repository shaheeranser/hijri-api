/**
 * Fetch and normalise announcement articles from RSS sources. The network is a
 * boundary: the fetcher is injected so tests run offline.
 */
import Parser from "rss-parser";
import { monthNameVariants } from "../hijri/months.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface SourceConfig {
  name: string;
  url: string;
}

export interface Article {
  title: string;
  link: string;
  /** Publisher, used to check that two *independent* sources agree. */
  publisher: string;
  feed: string;
  publishedAt?: string;
  summary?: string;
}

export interface SourceError {
  source: string;
  message: string;
}

export interface FetchArticlesResult {
  articles: Article[];
  errors: SourceError[];
}

/**
 * Google News RSS search feeds for the committee. Google News aggregates Dawn,
 * Geo, ARY, Express and others, and carries the publisher in `<source>`, which
 * is what we use for the two-source independence check.
 *
 * These generic queries are ranked by relevance, not recency, so for a month
 * with little press they can be dominated by older announcements and miss the
 * current one entirely. They stay as a broad fallback; `buildMonthSources`
 * adds queries tuned to the month being watched.
 */
export const COMMITTEE_SOURCES: SourceConfig[] = [
  {
    name: "Google News (English, Ruet-e-Hilal)",
    url: "https://news.google.com/rss/search?q=Ruet-e-Hilal+committee+Pakistan&hl=en-PK&gl=PK&ceid=PK:en",
  },
  {
    name: "Google News (English, Hilal Pakistan)",
    url: "https://news.google.com/rss/search?q=Hilal+committee+Pakistan+moon&hl=en-PK&gl=PK&ceid=PK:en",
  },
  {
    name: "Google News (Urdu, رویت ہلال)",
    url: "https://news.google.com/rss/search?q=%D8%B1%D9%88%DB%8C%D8%AA+%DB%81%D9%84%D8%A7%D9%84+%D9%BE%D8%A7%DA%A9%D8%B3%D8%AA%D8%A7%D9%86&hl=ur-PK&gl=PK&ceid=PK:ur",
  },
];

/**
 * Direct RSS from Pakistan outlets, independent of Google News rankings. APP is
 * the state wire and carries the official notification; the others add
 * independent confirmation.
 */
export const DIRECT_SOURCES: SourceConfig[] = [
  { name: "APP (direct)", url: "https://www.app.com.pk/feed/" },
  { name: "Business Recorder (direct)", url: "https://www.brecorder.com/feeds/latest-news" },
  { name: "The News (direct)", url: "https://www.thenews.com.pk/rss/1/2" },
];

const RECENCY = "when:3d";

function googleNewsQuery(query: string, hl: string, ceid: string): string {
  const params = new URLSearchParams({ q: query, hl, gl: "PK", ceid });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, "");
}

/** Distinct ASCII romanisations of a month, capped to keep the request count sane. */
function queryVariants(month: number, limit = 3): string[] {
  const seen = new Set<string>();
  const chosen: string[] = [];
  for (const variant of monthNameVariants(month)) {
    if (!/[a-z]/i.test(variant)) continue;
    const key = normalized(variant);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    chosen.push(variant);
    if (chosen.length >= limit) break;
  }
  return chosen;
}

/**
 * Search feeds tuned to the month being watched, across spellings, with a
 * recency filter so stale announcements cannot crowd out the current one.
 */
export function buildMonthSources(month: number): SourceConfig[] {
  const sources: SourceConfig[] = queryVariants(month).map((variant) => ({
    name: `Google News (EN, ${variant})`,
    url: googleNewsQuery(`${variant} moon Pakistan ${RECENCY}`, "en-PK", "PK:en"),
  }));
  const urdu = monthNameVariants(month).find((variant) => /[\u0600-\u06ff]/.test(variant));
  if (urdu !== undefined) {
    sources.push({
      name: `Google News (UR, ${urdu})`,
      url: googleNewsQuery(`${urdu} چاند Pakistan ${RECENCY}`, "ur-PK", "PK:ur"),
    });
  }
  return sources;
}

/**
 * The full source set: month-aware searches first, then the broad committee and
 * direct feeds as fallbacks. Pass the Hijri month being watched.
 */
export function buildSources(month?: number): SourceConfig[] {
  return [
    ...(month === undefined ? [] : buildMonthSources(month)),
    ...COMMITTEE_SOURCES,
    ...DIRECT_SOURCES,
  ];
}

/** Broad fallback set, used when the target month is unknown. */
export const DEFAULT_SOURCES: SourceConfig[] = buildSources();

interface RawItem {
  title?: unknown;
  link?: unknown;
  isoDate?: unknown;
  pubDate?: unknown;
  contentSnippet?: unknown;
  content?: unknown;
  source?: unknown;
}

/** rss-parser does not expose `<source>` by default; we need it for publishers. */
export function createParser(): Parser {
  return new Parser({ customFields: { item: [["source", "source"]] } });
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function publisherOf(item: RawItem, link: string): string {
  const source = item.source;
  if (typeof source === "string" && source.trim() !== "") return source.trim();
  if (typeof source === "object" && source !== null) {
    const record = source as Record<string, unknown>;
    const text = asString(record["_"]) ?? asString(record["title"]);
    if (text !== undefined) return text.trim();
  }
  try {
    return new URL(link).hostname;
  } catch {
    return "unknown";
  }
}

function toArticle(item: RawItem, feed: string): Article | undefined {
  const title = asString(item.title);
  const link = asString(item.link);
  if (title === undefined || link === undefined) return undefined;
  const publishedAt = asString(item.isoDate) ?? asString(item.pubDate);
  const summary = asString(item.contentSnippet) ?? asString(item.content);
  return {
    title,
    link,
    publisher: publisherOf(item, link),
    feed,
    ...(publishedAt === undefined ? {} : { publishedAt }),
    ...(summary === undefined ? {} : { summary }),
  };
}

/** Fetch every source, collecting per-source failures instead of aborting. */
export async function fetchArticles(
  sources: SourceConfig[],
  fetchImpl: FetchLike,
  parser: Parser = createParser(),
): Promise<FetchArticlesResult> {
  const articles: Article[] = [];
  const errors: SourceError[] = [];

  await Promise.all(
    sources.map(async (source) => {
      try {
        const response = await fetchImpl(source.url);
        if (!response.ok) {
          errors.push({ source: source.name, message: `HTTP ${response.status}` });
          return;
        }
        const xml = await response.text();
        const feed = await parser.parseString(xml);
        for (const item of feed.items as RawItem[]) {
          const article = toArticle(item, source.name);
          if (article !== undefined) articles.push(article);
        }
      } catch (error) {
        errors.push({ source: source.name, message: (error as Error).message });
      }
    }),
  );

  return { articles, errors };
}
