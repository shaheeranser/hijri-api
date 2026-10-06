# Implementation Proposal: Open Hijri Calendar and Prayer Times Data for Pakistan

**Status:** Draft
**Scope:** MVP
**Stack:** TypeScript on Node, GitHub Actions, GitHub Pages (static JSON)

---

## 1. Summary

Pakistan has no machine-readable source for sighted Hijri month starts. Popular sites such as Hamariweb and Urdupoint appear to publish these dates by manual update, and the Pakistan Meteorological Department (PMD) publishes only calculated dates, which are not authoritative because the Ruet-e-Hilal committee's sighting decision takes precedence.

This proposal describes an open-source project that:

1. Maintains a **verified, auditable archive** of Pakistan's sighted month starts, with a calculated fallback for unconfirmed months.
2. **Computes prayer times** (including sehri/iftar) locally for a small set of cities and sect/school profiles.
3. Runs a **watcher** on the 29th evening of each Hijri month that detects the committee's announcement and proposes the update for human approval.
4. Serves everything as **static JSON** from the repository itself, with thin client libraries on top.

The recurring cost is zero, and the repository is the single source of truth.

---

## 2. Background and Findings

### 2.1 Reverse-engineering the existing sites

- The first network request on Hamariweb/Urdupoint pages returns the complete server-rendered HTML. No JSON or other payload carrying the dates was found.
- Likely implementations: (a) dates are edited by hand after each announcement, or (b) a server-side Hijri conversion plus a single offset constant that an editor changes after each announcement.
- **Verification steps (research task, not a blocker):**
  - Pull Wayback Machine snapshots of their homepages around month boundaries. If the date flips at midnight each time, that shows when and by how much it was adjusted.
  - Convert the displayed dates with Umm al-Qura. A consistent difference of 0, -1 or -2 days suggests an algorithm plus offset.
  - Search page source for `hijri`, `islamic`, and Arabic/Urdu month names.

### 2.2 Why not just use PMD

PMD's calendar is calculated, not sighted. Pakistan frequently starts a month a day later than Saudi Arabia, so any purely calculated source (including Umm al-Qura) will be wrong for a noticeable fraction of months.

### 2.3 Where authoritative information actually appears

There is no API for sighting decisions. Announcements are made at press conferences and in press releases from the Ministry of Religious Affairs (which convenes the Central Ruet-e-Hilal Committee), with the Ministry of Science and Technology / PMD supplying astronomical input. They are relayed by APP, Radio Pakistan, PTV News, and major newspapers and channels (Dawn, Geo, ARY, Express), many of which publish RSS feeds. Any automated solution is therefore "watch the news for an announcement."

---

## 3. Goals and Non-Goals

### Goals

- A Hijri calendar API where every date carries an explicit **confidence level**.
- Accurate, calculated prayer start times for Karachi, Lahore and Peshawar, with a contributor-friendly path to add more cities.
- Support for multiple profiles: Sunni (Hanafi), Sunni (earlier Asr), and Shia (Jafari).
- Sehri and iftar times during Ramadan.
- Automated detection of announcements, with human approval before any date is published.
- Free hosting and a low maintenance burden.

### Non-goals

- Congregation (jamaat) times. These are set locally with no central source. The project states that it provides calculated start times only.
- Regional or unofficial sightings (e.g. the Khyber Pakhtunkhwa/Masjid Qasim Ali Khan sightings) in the main dataset. These may be added later as a separate regional layer.
- A paid or always-on backend.

---

## 4. Architecture

The repository is the data store, the build system and the API.

```
data/hijri/overrides.json                      # confirmed month starts (PR-edited)
data/hijri/calendar/1448.json                  # generated: Gregorian date -> Hijri date + confidence
data/cities.json                               # city table (lat, lon, elevation), PR-extensible
data/prayer/<city>/<profile>/<year>.json       # generated prayer times
watcher/                                       # 29th-evening detection script
generator/                                     # builds calendar + prayer JSON
packages/js                                    # reference client (TypeScript)
.github/workflows/                             # watcher, generate, deploy
```

- **GitHub Pages** serves the JSON as static files, with open CORS headers so browser apps can fetch it directly.
- **GitHub Actions** is the backend: scheduled workflows run the watcher and regenerate data.
- Prayer times and Hijri dates are **decoupled**. Prayer times do not depend on the Hijri calendar. A client joins them only to decide whether to show sehri/iftar.

The data volume is small: 3 cities x 3 profiles x 365 days is a few thousand rows per year.

---

## 5. Hijri Calendar Module

### 5.1 Data model

Store **confirmed start dates**, not offsets. An offset applied to a calculated calendar cascades, since one wrong correction shifts every later month. Start dates keep errors local.

```jsonc
// data/hijri/overrides.json (values illustrative)
{
  "coverage_start": "YYYY-MM-DD",
  "months": {
    "1447-09-01": {
      "date": "YYYY-MM-DD",
      "sources": ["https://...", "https://..."]
    }
  }
}
```

- Every override entry **requires at least one source URL**, so the record is auditable and backfilling can be crowd-sourced.
- All conversions use the override table first. Months beyond the last confirmed one fall back to the baseline calculation.

### 5.2 Confidence levels

| Level | Meaning |
|---|---|
| `confirmed` | A verified start date exists in `overrides.json`. |
| `estimated` | No verified entry for a past month. The date comes from the baseline calculation. |
| `predicted` | A future month, calculated from the baseline. |
| `unconfirmed` | Within the ambiguity window between the 29th evening and the announcement. |

`coverage_start` lets clients distinguish "out of range" from "estimated."

### 5.3 Baseline calculation

- Start with `Intl` using `islamic-umalqura` (Node ships full ICU).
- Optionally improve prediction with `astronomy-engine`: compute moon age, altitude and elongation at sunset for Pakistan and apply a visibility criterion (Odeh or Yallop).
- Umm al-Qura alone is wrong fairly often for Pakistan, so the baseline is never presented as official.

### 5.4 Day rollover

Islamically the day begins at Maghrib. Civil calendars flip at midnight.

- The default response is the **midnight-based** date.
- An explicit `after_maghrib` flag returns the Maghrib-based date.
- Because the data is static, the client computes this: the calendar file gives the midnight-based Hijri date, and the prayer file gives that day's Maghrib. The client library exposes `hijriDate(now, { afterMaghrib })` so the logic lives in one tested place.
- Each function and endpoint documents which convention it uses.

---

## 6. Announcement Watcher

### 6.1 Timing

The committee meets on the evening of the **29th**. If the moon is sighted, the next day is the 1st. Otherwise the 30th occurs and the following day is the 1st. A month length is therefore always known by about 29th Maghrib plus a few hours.

### 6.2 Detection strategy

The watcher does not need heavy NLP. There are only two outcomes, so it looks for the announced date instead of interpreting "sighted / not sighted":

1. Pre-compute the two candidate dates for the 1st (e.g. Monday vs Tuesday).
2. Poll sources: news RSS feeds, Google News RSS for "Ruet-e-Hilal" / رویتِ ہلال, and the ministry's X account if accessible.
3. Filter to articles mentioning the committee and the relevant month name.
4. Check which candidate date or weekday appears near phrases such as "1st of", "Eid", or "Ramadan will begin" (using `chrono-node` or regex), in English and Urdu.
5. Require **two independent sources to agree**.

**Optional LLM fallback:** run it only on articles that pass the keyword filter, and ask it to extract the announced date of the 1st rather than a sighted/not-sighted boolean. This is a handful of calls per month, with negligible cost.

### 6.3 Human confirmation via pull request

The watcher opens a **PR** with the proposed `overrides.json` entry and the matched article links. Merging it (possible from a phone) triggers regeneration and a Pages deploy. This provides the approval step and an audit trail. Keyword matching can misfire on zonal committees, Peshawar's separate sighting, and "moon not yet sighted" headlines, and a wrong month start is the worst failure mode for this service.

### 6.4 GitHub Actions specifics

- **Date-gate the script.** Run on a frequent cron, but exit unless today is the 29th (confirmed start + 28 days) and the time is past the computed Maghrib.
- **Poll every 10-15 minutes** from Maghrib until about 1 AM Karachi time. Scheduled runs can be delayed by many minutes, so do not rely on a single run.
- **Cron is in UTC** (Pakistan is UTC+5).
- **Inactive repos:** GitHub disables scheduled workflows after 60 days without repository activity. Monthly commits keep it alive, and the README should note this.

### 6.5 Failure mode

If the announcement is missed, the cost is bounded: if the 29th is not sighted, the 1st is always 30 days after the previous start, and the 30th evening settles it. During that window the API publishes `unconfirmed` rather than guessing.

### 6.6 Cross-check

Scrape Hamariweb/Urdupoint's displayed date daily and alert on disagreement. These sites are a sanity check, **not a source**.

---

## 7. Prayer Times Module

### 7.1 Approach

Prayer times are deterministic astronomical calculations, so they are computed locally from latitude/longitude with no external API, no rate limits and no runtime dependency. Libraries: `adhan` (preferred) or `astronomy-engine`. Aladhan's API (`method=1`, `school=1`) is a reasonable cross-check but not a dependency.

### 7.2 Profiles

The astronomy is identical for everyone, and only a few parameters differ.

| Parameter | Sunni (Hanafi) | Sunni (earlier Asr) | Shia (Jafari) |
|---|---|---|---|
| Fajr angle | 18° | 18° | 16° (Leva/Qom) or 17.7° (Tehran) |
| Isha angle | 18° | 18° | 14° |
| Asr shadow factor | 2x | 1x | 1x |
| Maghrib | Sunset | Sunset | Sun 4° below horizon (Leva) or 4.5° (Tehran) |
| Sehri ends | Fajr | Fajr | Fajr minus a precaution offset |
| Iftar | Maghrib | Maghrib | Jafari Maghrib |

Notes:

- **Do not double-count the Shia Maghrib offset.** The 4° rule already lands roughly a quarter hour after sunset at Pakistani latitudes. Use either the angle or sunset plus a fixed offset, not both. Compare each against a real Shia timetable to decide.
- The Hanafi Asr is typically 45 minutes to over an hour later than the shadow-factor-1 Asr. Label the profile clearly in the UI.
- Sehri/iftar offsets are **config values**, not constants, since printed Pakistani timetables often add a minute or two of precaution.

### 7.3 Configuration shape

```ts
const PROFILES = {
  sunni_hanafi: {
    fajrAngle: 18, ishaAngle: 18, asrFactor: 2,
    maghrib: { type: "sunset" },
    sehriOffsetMin: 0, iftarOffsetMin: 0,
    adjustMin: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  },
  sunni_asr1: { /* as above with asrFactor: 1 */ },
  shia_jafari: {
    fajrAngle: 16, ishaAngle: 14, asrFactor: 1,
    maghrib: { type: "angle", value: 4 },
    sehriOffsetMin: -10, iftarOffsetMin: 0,
  },
};
```

### 7.4 Cities and timezone

- MVP cities: **Karachi, Lahore, Peshawar**. Longitude differences produce 20+ minutes of solar noon difference, so a single national timetable is not acceptable.
- Cities live in a plain data file (`data/cities.json`) so contributors can add rows through pull requests.
- Timezone is `Asia/Karachi` via the IANA database. Pakistan used DST in 2002, 2008 and 2009, so historical generation should defer to the tz database.
- Northern areas (Gilgit, Skardu) resolve twilight angles fine, so no high-latitude fallback is needed.
- Sunrise is included because it marks the end of Fajr. Zuhr begins at solar transit, and published timetables usually add a few minutes of margin, so a per-prayer adjustment field is provided.

### 7.5 Sehri/Iftar visibility

Shown only during Ramadan, driven by the Hijri module. This is the single point of coupling between the two modules.

### 7.6 Validation

Before release, compare output for Karachi, Lahore and Peshawar against PMD's published timetables and a few mosque or imambargah timetables, in one winter and one summer month. Differences of one to two minutes are rounding. Consistently larger differences indicate a wrong parameter, and `adjustMin` is the fix.

---

## 8. Past Dates and Backfill

The MVP does **not** require a complete historical record. Unverified past months are served as `estimated` and are never presented as official.

Backfill is an incremental improvement:

1. **Anchor months first:** Ramadan, Eid ul Fitr, Eid ul Adha, Muharram/Ashura and Rabi ul Awal are well documented in news archives and holiday notifications.
2. **Use month-length constraints:** every month has 29 or 30 days, so two anchors n months apart fix the total number of days between them. For gaps of two or three months only a few combinations remain, and one dated source (newspaper dateline, notification, court order) usually resolves them.
3. **Crowd-source the rest:** make "add a verified month start with a source link" a good-first-issue pull request.

Going forward, the watcher builds the verified record automatically, which is the project's long-term value.

---

## 9. Distribution and Clients

### 9.1 API: static JSON

GitHub Pages serves the files directly. Pages caches for around 10 minutes, which is fine for data that changes monthly. If an endpoint with query parameters is ever needed, a Cloudflare Worker (free tier) can wrap the same JSON in a small amount of code. It is not required for the MVP.

### 9.2 Library and CLI

The library and CLI should not become a competing source of truth. They:

1. **Bundle a snapshot** of the data at release time, so they work offline with zero setup.
2. **Optionally fetch** the live `overrides.json` from Pages and cache it.
3. **Report data age and confidence**, so consumers know when they are on stale predictions.

### 9.3 Language choice

The Actions runner is an ordinary Linux VM, so the runtime does not constrain the choice. The decisive factor is where code is shared: the client logic (the `afterMaghrib` comparison, confidence handling, sehri/iftar gating) is what people depend on, and in TypeScript it runs unchanged in browsers, Node and edge workers. Prayer times are precomputed, so clients never need the astronomy library. **The JSON is the real contract**, and Python or Rust clients can be added later as thin readers.

Proposed stack: TypeScript on Node, `adhan`, `astronomy-engine`, `Intl` (`islamic-umalqura`), `rss-parser`, `chrono-node`, `Luxon`. Python is suitable for throwaway backfill analysis only.

---

## 10. Milestones

| # | Milestone | Outcome |
|---|---|---|
| 0 | Research | Wayback analysis of Hamariweb/Urdupoint offset history. Baseline vs Umm al-Qura comparison. |
| 1 | Data model | `overrides.json` schema with sources, confidence resolution logic, `coverage_start`. |
| 2 | Calendar generator | Builds yearly Hijri JSON from baseline + overrides. |
| 3 | Prayer generator | Three cities x three profiles, validated against PMD and local timetables. |
| 4 | Client library | Rollover logic, offline bundle, optional live refresh. |
| 5 | Watcher | Date-gated polling, date extraction, PR creation. Dry-run for at least one month cycle. |
| 6 | Release | README, licensing, contribution guide, Pages deploy. |
| 7 | Backfill | Anchor months, then community pull requests. |

---

## 11. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Wrong month start published | Two-source agreement, mandatory human PR approval, explicit `unconfirmed` state. |
| Baseline differs from Pakistan's sighting | Baseline is always labelled `estimated` or `predicted`. |
| Noisy news matching (zonal committees, Peshawar, "not sighted" headlines) | Extract announced dates instead of sentiment, filter by committee and month name. |
| Scheduled workflows delayed or disabled | Poll window instead of single run, monthly commits, documented in README. |
| Prayer times differ from local timetables | Per-prayer `adjustMin`, validation against published timetables, "calculated times" disclaimer. |
| Source data licensing | Cite sources for every confirmed date, add `LICENSE` for code and a data-usage note. |
| Single maintainer | Contributor-friendly structure (city table, override PRs). |

---

## 12. Open Questions

- Should the dataset eventually include a separate regional layer for unofficial sightings?
- Which Shia Maghrib convention (Leva 4° or Tehran 4.5°) best matches Pakistani Shia timetables?
- Does Hamariweb/Urdupoint's history show a consistent offset pattern that could seed past data?
- Is a Cloudflare Worker endpoint worth adding after the MVP, based on actual consumer demand?
