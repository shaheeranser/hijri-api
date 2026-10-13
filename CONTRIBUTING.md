# Contributing

## Adding a confirmed month start

The confirmed record is the project's reason to exist, so contributions here are the
most valuable.

1. Edit `data/hijri/overrides.json`.
2. Add an entry keyed by the Hijri 1st (`YYYY-MM-DD`), with the Gregorian date it
   began and at least one public source URL.
3. Run `npm run generate` to rebuild the calendar files.
4. Open the pull request with the
   [backfill month](.github/PULL_REQUEST_TEMPLATE/backfill-month.md) template, which
   asks for the date and the sources.

```jsonc
{
  "coverage_start": "2025-03-01",
  "months": {
    "1446-09-01": {
      "date": "2025-03-01",
      "sources": ["https://example.com/news/ramadan-begins"]
    }
  }
}
```

Rules the generator enforces (`src/hijri/overrides.ts`):

- Every entry needs at least one `http(s)` source URL.
- Dates must be real `YYYY-MM-DD` calendar dates.
- Two months cannot start on the same day.

Leave `coverage_start` as `null`; the generator derives it from the earliest
confirmed month.

Store **confirmed start dates, not offsets**. An offset applied to a calculated
calendar cascades, because one wrong correction shifts every later month; start dates
keep the error local.

## How the watcher runs

The watcher (`.github/workflows/watcher.yml`) polls the news on the 29th evening, requires
two independent publishers to agree on a date, and opens a pull request — the update never
reaches `main` without a human merging it.

Two things to know when you touch it:

- **Discovery is month-aware.** Generic "Ruet-e-Hilal" searches are ranked by relevance and
  can be dominated by older announcements, so the watcher also queries the exact month across
  spellings (see `MONTH_NAME_VARIANTS` in `src/hijri/months.ts`) and reads direct feeds. If a
  month is regularly missed, add its romanisations there before widening the queries.
- **GitHub `schedule` is not reliable.** It delays and drops runs under load; in practice the
  `*/15` cron fires only a handful of times per day. Wire up an external dispatcher to cover
  the 29th evening. Give it a fine-grained token with `actions: write` and have it POST:

  ```bash
  gh api -X POST repos/<owner>/<repo>/actions/workflows/watcher.yml/dispatches \
    -f ref=main -F inputs[dry_run]=false
  ```

  Run it every ~15 minutes through the 13:00-20:00 UTC window; the script date-gates, so runs
  outside the window exit immediately.

To debug a run locally, simulate the clock and print what the watcher saw:

```bash
npx tsx src/cli.ts watch --now 2026-10-12T20:00:00+05:00 --dump
```

Every workflow run uploads `watcher-out/run.json` and writes it to the run summary, including
date sightings and near misses. When the polling window closes without a confirmed start, the
workflow opens (or updates) an issue so the failure is never silent.

## Adding a city

Append a row to `data/cities.json`:

```json
{
  "id": "quetta",
  "name": "Quetta",
  "province": "Balochistan",
  "latitude": 30.1798,
  "longitude": 66.9750,
  "elevation": 1680,
  "timezone": "Asia/Karachi"
}
```

`id` must be a lowercase slug, `timezone` a valid IANA name. Then run
`npm run generate` so the new city's prayer files are produced. `elevation` is
recorded for reference; the calculation library does not use it.

## Adjusting a profile

Calculation parameters live in `src/prayer/profiles.ts` and are documented in the
implementation proposal (section 7.2). To correct a profile against a real timetable,
use the per-prayer `adjustMin` fields rather than changing the angles, and explain the
comparison in your pull request.

## Development

```bash
npm install
npm test            # vitest, colocated as *.test.ts
npm run typecheck
npm run build
```

Tests must pass and `npm run typecheck` must be clean before a pull request. New
behaviour needs a test; keep tests deterministic and offline (inject clocks,
fetchers, and data rather than reaching for the network).

Generated files under `data/hijri/calendar/` and `data/prayer/` are committed on
purpose: they are the deployed product, not build output. Do not edit them by hand —
change the generator and rerun it.

## Reporting a wrong date

Open an issue with the Hijri month, the published Gregorian date, and a source for
the correct one. A wrong month start is the most serious bug in this project, so
please err on the side of reporting it.
