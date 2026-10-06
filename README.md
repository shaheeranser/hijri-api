# hijri-api

Open Hijri calendar and prayer time data for Pakistan, served as static JSON.

Pakistan has no machine-readable source for **sighted** Hijri month starts. Popular
sites appear to update their dates by hand, and the PMD publishes only calculated
dates, which are not authoritative because the Ruet-e-Hilal Committee's sighting
decision takes precedence.

This project keeps a verified, auditable archive of Pakistan's sighted month starts
with a calculated fallback, computes prayer times locally, and watches the news for
each announcement so a human can approve the update through a pull request.

The repository is the data store, the build system and the API. There is no backend
and the recurring cost is zero.

> **Status:** MVP. Every published Hijri date carries an explicit confidence level,
> and prayer times are calculated, not observed.

## Endpoints

GitHub Pages serves the JSON in `data/` as the site root with open CORS, so browser
apps can fetch it directly. Replace `<owner>` with the hosting account.

| Path | Contents |
|---|---|
| `/hijri/index.json` | Manifest: coverage, generated timestamp, available Hijri years |
| `/hijri/overrides.json` | The confirmed month-start record (human-edited) |
| `/hijri/calendar/<hijriYear>.json` | Gregorian date → Hijri date + confidence |
| `/prayer/<city>/<profile>/<year>.json` | Daily prayer times for one city, profile and Gregorian year |

Cities: `karachi`, `lahore`, `peshawar`. Profiles: `sunni_hanafi`, `sunni_asr1`
(earlier Asr), `shia_jafari`.

```jsonc
// GET /hijri/calendar/1448.json
{
  "hijri_year": 1448,
  "coverage_start": null,
  "generated_at": "2026-10-06T09:12:04.402Z",
  "baseline": "islamic-umalqura (Intl)",
  "days": {
    "2026-10-06": {
      "hijri": "1448-04-25",
      "year": 1448, "month": 4, "day": 25,
      "month_name": { "en": "Rabi al-Thani", "ur": "ربیع الثانی" },
      "confidence": "predicted"
    }
  }
}
```

Prayer times are stored as ISO 8601 instants with the Pakistan offset, e.g.
`"2026-06-21T19:24:00+05:00"`, so the instant and the local clock time are both
unambiguous.

## Confidence levels

Every Hijri date states how it was derived. A client should never present a
non-`confirmed` date as official.

| Level | Meaning |
|---|---|
| `confirmed` | A verified start date exists in `overrides.json` |
| `estimated` | A past month with no verified entry; comes from the baseline calculation |
| `predicted` | A future month; comes from the baseline calculation |
| `unconfirmed` | The last day of a month, where the sighting decides whether a 30th day exists |

`coverage_start` on each file lets clients distinguish "out of range" from
"estimated".

## Day rollover

Islamically the day begins at Maghrib; civil calendars flip at midnight. The
calendar files use the midnight-based date. The client computes the Maghrib-based
date from the prayer table so the logic lives in one tested place.

## Client library

The package bundles the client only. Prayer times are precomputed, so consumers
never need the astronomy library. The JSON is the real contract; other languages can
read it directly.

```ts
import { HijriCalendar, PrayerTable, hijriDate, sehriIftar } from "hijri-api";

const base = "https://<owner>.github.io/hijri-api";
const calendar = HijriCalendar.fromJSON(await (await fetch(`${base}/hijri/calendar/1448.json`)).json());
const prayer = PrayerTable.fromJSON(await (await fetch(`${base}/prayer/karachi/sunni_hanafi/2026.json`)).json());

const now = new Date();
const maghrib = prayer.maghrib("2026-03-01");
const today = hijriDate(now, { calendar, afterMaghrib: true, maghrib });

console.log(today.hijri, today.confidence); // e.g. "1447-09-02", "confirmed"

const fast = sehriIftar(prayer, today.gregorian, today);
if (fast) console.log("Sehri ends", fast.sehriEnds, "Iftar", fast.iftar);
```

`hijriDate` throws `OutOfRangeError` rather than guessing when the loaded data does
not cover the date. Sehri and iftar are returned only during Ramadan.

## CLI

```bash
npm install
npm test                 # run the suite
npm run generate         # rebuild data/hijri/calendar and data/prayer
npm run generate -- --dry-run
npm run watcher          # dry run: detect and print, never write
npm run watcher -- --write   # write overrides.json + watcher-out/pull-request.md
```

`generate` writes the requested Hijri years (`--hijri-years 1448,1449`) and Gregorian
years (`--years 2026,2027`); it defaults to the current and next year for each.

## The watcher

The Ruet-e-Hilal Committee meets on the evening of the 29th. There are only two
possible outcomes, so the watcher looks for the **announced date of the 1st** rather
than interpreting "sighted / not sighted":

1. Compute the two candidate dates (29 and 30 days after the last confirmed start).
2. Poll news feeds and the ministry's channels.
3. Filter to articles mentioning the committee, then extract a candidate date or
   weekday from the title near a start phrase.
4. Require **two independent publishers** to agree.
5. Open a pull request with the proposed `overrides.json` entry and the evidence.

The watcher never writes to `main`. Merging the pull request (possible from a phone)
triggers regeneration and a Pages deploy, which is the approval step and the audit
trail. Keyword matching can misfire on zonal committees and "not yet sighted"
headlines, and a wrong month start is the worst possible failure, so a human stays
in the loop.

The workflow polls every 15 minutes between 13:00 and 20:00 UTC (evening in
Karachi), date-gates precisely on the computed Maghrib, and runs from the 29th
evening until a month length is settled. If an announcement is ever missed, the
month the API publishes is `unconfirmed` rather than a guess.

**Notes for maintainers:**

- The watcher measures from the **last confirmed start**, so it needs at least one
  verified month in `overrides.json` before it can run. Backfill one recent anchor
  (for example the current Ramadan) first; after that the watcher maintains the
  record itself.
- GitHub disables scheduled workflows after 60 days without repository activity. The
  monthly `generate` run keeps the repository alive.
- GitHub Pages serves the data with permissive CORS. If a stricter CORS need arises,
  a small Cloudflare Worker can wrap the same JSON.
- An optional LLM fallback (only on articles that pass the keyword filter) could
  improve extraction. It is not part of the MVP.

## Local development

Requires Node 20 or newer.

```bash
npm install
npm test
npm run typecheck
npm run build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to add a city or a confirmed month,
and [MODULES.md](./MODULES.md) for the code layout.

## Data accuracy and licensing

Prayer times are **calculated, not observed**. They are provided for guidance only;
always defer to your local mosque or imambargah. Printed timetables often add a
minute or two of precaution, which is why each profile carries per-prayer and
sehri/iftar offset settings.

Every confirmed month start cites at least one public source URL. Code is MIT
licensed (see [LICENSE](./LICENSE)); the data carries the same usage note.
