import { describe, expect, it } from "vitest";
import { parseOverrides } from "../hijri/overrides.js";
import { runWatcher, type WatcherOptions } from "./watcher.js";
import type { FetchLike, SourceConfig } from "./sources.js";

const sources: SourceConfig[] = [{ name: "Test Feed", url: "https://feed.test/rss" }];
const maghribFor = (): Date => new Date("2025-03-29T18:30:00+05:00");

function rss(items: { title: string; link: string; publisher: string; pubDate?: string }[]): string {
  const entries = items
    .map(
      (item) =>
        `<item><title>${item.title}</title><link>${item.link}</link>` +
        `<source url="${item.link}">${item.publisher}</source>` +
        `${item.pubDate === undefined ? "" : `<pubDate>${item.pubDate}</pubDate>`}` +
        `<description>${item.title}</description></item>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Test</title>${entries}</channel></rss>`;
}

function fetchReturning(xml: string): FetchLike {
  return async () => new Response(xml, { status: 200 });
}

const baseline = parseOverrides({
  coverage_start: "2025-03-01",
  months: { "1446-09-01": { date: "2025-03-01", sources: ["https://example.com/a"] } },
});

function options(overrides: WatcherOptions["overrides"], fetchImpl: FetchLike, now = new Date("2025-03-29T20:00:00+05:00")): WatcherOptions {
  return { overrides, fetchImpl, maghribFor, now, sources };
}

const dawn = { title: "Ruet-e-Hilal announces Ramadan will begin on March 30", link: "https://dawn.com/a", publisher: "Dawn" };
const geo = { title: "Hilal committee: Ramadan begins March 30", link: "https://geo.tv/b", publisher: "Geo" };
const bothAnnounceMarch30 = [dawn, geo];

describe("runWatcher", () => {
  it("reports no baseline when the record is empty", async () => {
    const empty = parseOverrides({ coverage_start: null, months: {} });
    expect((await runWatcher(options(empty, fetchReturning("")))).status).toBe("no-baseline");
  });

  it("is not due outside the polling window", async () => {
    const outcome = await runWatcher(options(baseline, fetchReturning(""), new Date("2025-03-10T12:00:00+05:00")));
    expect(outcome.status).toBe("not-due");
  });

  it("reports overdue once the window closes without a confirmation", async () => {
    const outcome = await runWatcher(options(baseline, fetchReturning(""), new Date("2025-04-01T12:00:00+05:00")));
    expect(outcome).toMatchObject({ status: "overdue", latest: "2025-03-31" });
    if (outcome.status === "overdue") {
      expect(outcome.expected).toEqual({ year: 1446, month: 10, day: 1 });
    }
  });

  it("proposes when two independent publishers agree", async () => {
    const outcome = await runWatcher(options(baseline, fetchReturning(rss(bothAnnounceMarch30))));
    expect(outcome).toMatchObject({ status: "proposed" });
    if (outcome.status === "proposed") {
      expect(outcome.proposal.gregorian).toBe("2025-03-30");
      expect(outcome.proposal.hijriKey).toBe("1446-10-01");
    }
  });

  it("proposes when publishers name the month but never say committee", async () => {
    const app = { title: "Shawwal moon sighted in Pakistan, first day to fall on March 31", link: "https://app.com.pk/a", publisher: "| Associated Press Of Pakistan" };
    const hd = { title: "Shawwal moon sighted, first day to fall on Monday", link: "https://24newshd.tv/b", publisher: "24 News HD" };
    const outcome = await runWatcher(options(baseline, fetchReturning(rss([app, hd]))));
    expect(outcome).toMatchObject({ status: "proposed" });
    if (outcome.status === "proposed") expect(outcome.proposal.gregorian).toBe("2025-03-31");
  });

  it("reports near misses when an announcement has no readable date", async () => {
    const vague = { title: "Ruet-e-Hilal Committee to announce Shawwal moon tonight", link: "https://dawn.com/x", publisher: "Dawn" };
    const outcome = await runWatcher(options(baseline, fetchReturning(rss([vague]))));
    expect(outcome.status).toBe("no-announcement");
    if (outcome.status === "no-announcement") {
      expect(outcome.sightings).toEqual([]);
      expect(outcome.nearMisses).toHaveLength(1);
      expect(outcome.nearMisses[0]?.title).toContain("Shawwal");
    }
  });

  it("ignores a stale announcement from outside the polling window", async () => {
    const stale = { title: "Ruet-e-Hilal announces Ramadan will begin on March 30", link: "https://dawn.com/old", publisher: "Dawn", pubDate: "2024-03-29T20:00:00+05:00" };
    const fresh = { title: "Ruet-e-Hilal: Ramadan begins March 30", link: "https://geo.tv/new", publisher: "Geo", pubDate: "2025-03-29T20:00:00+05:00" };
    const outcome = await runWatcher(options(baseline, fetchReturning(rss([stale, fresh]))));
    expect(outcome.status).toBe("no-announcement");
    if (outcome.status === "no-announcement") {
      expect(outcome.sightings.map((s) => s.publisher)).toEqual(["Geo"]);
      expect(outcome.articlesInWindow).toBe(1);
    }
  });

  it("does not propose on a single publisher", async () => {
    const single = [dawn, { ...geo, publisher: "Dawn" }];
    const outcome = await runWatcher(options(baseline, fetchReturning(rss(single))));
    expect(outcome.status).toBe("no-announcement");
  });

  it("still proposes when one source fails", async () => {
    const twoSources: SourceConfig[] = [...sources, { name: "Broken", url: "https://broken.test/rss" }];
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes("broken")) throw new Error("network down");
      return new Response(rss(bothAnnounceMarch30), { status: 200 });
    };
    const outcome = await runWatcher({ ...options(baseline, fetchImpl), sources: twoSources });
    expect(outcome.status).toBe("proposed");
  });

  it("reports fetch-failed when every source fails", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("network down");
    };
    const outcome = await runWatcher(options(baseline, fetchImpl));
    expect(outcome.status).toBe("fetch-failed");
  });
});
