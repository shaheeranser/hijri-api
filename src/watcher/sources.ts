/**
 * Fetch and normalise announcement articles from RSS sources. The network is a
 * boundary: the fetcher is injected so tests run offline.
 */
import Parser from "rss-parser";

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
 */
export const DEFAULT_SOURCES: SourceConfig[] = [
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
