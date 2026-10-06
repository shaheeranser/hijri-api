# hijri-api

Open Hijri calendar and prayer time data for Pakistan, served as static JSON.

Pakistan has no machine-readable source for **sighted** Hijri month starts. This project keeps a
verified, auditable archive of them with a calculated fallback, computes prayer times locally, and
watches the news for each announcement so a human approves the update through a pull request. The
repository is the data store, the build system and the API.

> Every published Hijri date carries a confidence level; prayer times are calculated, not observed.

## API

Base URL: `https://shaheeranser.github.io/hijri-api`. All routes are `GET`, served with
`access-control-allow-origin: *`.

| Route | Returns |
|---|---|
| `/hijri/index.json` | Coverage, generation time, available Hijri years |
| `/hijri/overrides.json` | The confirmed month-start record (human-edited, with sources) |
| `/hijri/calendar/<hijriYear>.json` | Gregorian date → Hijri date + confidence |
| `/prayer/<city>/<profile>/<year>.json` | Daily prayer times |

Cities: `karachi`, `lahore`, `peshawar`. Profiles: `sunni_hanafi`, `sunni_asr1` (earlier Asr),
`shia_jafari`.

### Confidence

| Level | Meaning |
|---|---|
| `confirmed` | A verified start date exists in `overrides.json` |
| `estimated` | A past month with no verified entry; from the baseline |
| `predicted` | A future month; from the baseline |
| `unconfirmed` | The last day of a month, where the sighting decides whether a 30th day exists |

Never present a non-`confirmed` date as official. `coverage_start` distinguishes "out of range"
from "estimated".

## Client

The package ships the client only; prayer times are precomputed, so no astronomy library is needed.
The JSON is the real contract, so other languages can read it directly.

```ts
import { HijriCalendar, PrayerTable, hijriDate, sehriIftar } from "hijri-api";

const base = "https://shaheeranser.github.io/hijri-api";
const calendar = HijriCalendar.fromJSON(await (await fetch(`${base}/hijri/calendar/1448.json`)).json());
const prayer = PrayerTable.fromJSON(await (await fetch(`${base}/prayer/karachi/sunni_hanafi/2026.json`)).json());

// Default is the midnight-based date; pass afterMaghrib with that day's Maghrib for the Islamic day.
const today = hijriDate(new Date(), { calendar, afterMaghrib: true, maghrib: prayer.maghrib("2026-03-01") });
console.log(today.hijri, today.confidence);

const fast = sehriIftar(prayer, today.gregorian, today);
if (fast) console.log("Sehri ends", fast.sehriEnds, "Iftar", fast.iftar);
```

`hijriDate` throws `OutOfRangeError` rather than guessing when data does not cover the date; sehri
and iftar are returned only during Ramadan.

## Development

Requires Node 20+.

```bash
npm install
npm test                 # vitest
npm run generate         # rebuild data/hijri/calendar and data/prayer
npm run watcher          # dry run: detect and print, never write
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for adding a city or a confirmed month, and
[MODULES.md](./MODULES.md) for the code layout.

## Watcher

The Ruet-e-Hilal Committee meets on the evening of the 29th, so the watcher computes the two
candidate dates, polls the news, and proposes an `overrides.json` entry only when **two independent
publishers agree** on the same date. It opens a pull request rather than writing to `main`; merging
it triggers regeneration and deploy. A wrong month start is the worst failure mode, so a human stays
in the loop. It measures from the last confirmed start, so backfill one recent anchor first.

## Accuracy and license

Prayer times are calculated, not observed: for guidance only, and always defer to your local mosque
or imambargah. Every confirmed month cites at least one public source. Code is MIT licensed
([LICENSE](./LICENSE)).
