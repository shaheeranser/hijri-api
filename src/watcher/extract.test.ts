import { describe, expect, it } from "vitest";
import { buildCandidates } from "./candidates.js";
import { extractAnnouncedStart } from "./extract.js";
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
