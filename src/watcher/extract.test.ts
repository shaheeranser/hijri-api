import { describe, expect, it } from "vitest";
import { monthNameVariants } from "../hijri/months.js";
import { buildCandidates } from "./candidates.js";
import { extractAnnouncedStart, isRelevantAnnouncement } from "./extract.js";
import type { Article } from "./sources.js";

const candidates = buildCandidates("2025-03-01", "Asia/Karachi").candidates;
const reference = new Date("2025-03-29T20:00:00+05:00");

function article(title: string, summary?: string): Article {
  return { title, link: "https://example.com/a", publisher: "Dawn", feed: "test", ...(summary === undefined ? {} : { summary }) };
}

describe("extractAnnouncedStart", () => {
  it("matches an explicit announced date", () => {
    const result = extractAnnouncedStart(article("Ruet-e-Hilal Committee announces Ramadan will begin on March 30"), candidates, reference);
    expect(result).toMatchObject({ date: "2025-03-30", strength: "strong" });
  });

  it("matches a weekday near a start phrase", () => {
    const result = extractAnnouncedStart(article("Ruet-e-Hilal: moon not sighted, Ramadan begins Monday"), candidates, reference);
    expect(result?.date).toBe("2025-03-31");
  });

  it("matches Urdu weekday and start phrase", () => {
    const result = extractAnnouncedStart(article("رویت ہلال کمیٹی کا اجلاس پیر کو، رمضان شروع"), candidates, reference);
    expect(result?.date).toBe("2025-03-31");
  });

  it("ignores articles without committee context", () => {
    expect(extractAnnouncedStart(article("Cricket: Pakistan plays on Monday"), candidates, reference)).toBeUndefined();
  });

  it("ignores a committee meeting that does not announce a start", () => {
    expect(extractAnnouncedStart(article("Ruet-e-Hilal committee will meet on Monday"), candidates, reference)).toBeUndefined();
  });
});

// The 1 Jumada al-Awwal 1448 announcement (2026-10-13), which the watcher
// missed: the winning headlines never say "Ruet-e-Hilal" or "committee".
describe("extractAnnouncedStart (real Jumada al-Awwal headlines)", () => {
  const jumada = buildCandidates("2026-09-14", "Asia/Karachi").candidates;
  const reference = new Date("2026-10-12T20:00:00+05:00");
  const variants = monthNameVariants(5);

  it("reads an explicit date from a headline without committee vocabulary", () => {
    const result = extractAnnouncedStart(
      article("Jamadi-ul-Awwal moon sighted in Pakistan, first day to fall on October 13", undefined),
      jumada,
      reference,
      variants,
    );
    expect(result).toMatchObject({ date: "2026-10-13" });
  });

  it("reads a weekday from the 24 News HD headline", () => {
    const result = extractAnnouncedStart(
      article("Jamadi-ul-Awwal moon sighted, first day to fall on Tuesday"),
      jumada,
      reference,
      variants,
    );
    expect(result?.date).toBe("2026-10-13");
  });

  it("maps a bare 'not sighted' to the 30-day candidate", () => {
    const result = extractAnnouncedStart(
      article("Jamadi-ul-Awwal moon not sighted, the new month will commence"),
      jumada,
      reference,
      variants,
    );
    expect(result?.date).toBe("2026-10-14");
  });

  it("still rejects the same headline when the month is not named", () => {
    expect(
      extractAnnouncedStart(
        article("Jamadi-ul-Awwal moon sighted in Pakistan, first day to fall on October 13"),
        jumada,
        reference,
      ),
    ).toBeUndefined();
  });

  it("flags an announcement-shaped article with no readable date as relevant", () => {
    expect(isRelevantAnnouncement(article("Ruet-e-Hilal Committee to announce Shawwal moon tonight"), monthNameVariants(10))).toBe(true);
    expect(isRelevantAnnouncement(article("Pakistan cricket team wins"), monthNameVariants(10))).toBe(false);
  });
});
