# Module map

Each module owns one responsibility. Dependencies point downward: the client and the
watcher/build tooling sit above the domain modules, and nothing in the domain imports
the CLI.

| Path | Responsibility |
|---|---|
| `src/types.ts` | The published JSON contract (types only, no logic) |
| `src/dates.ts` | UTC / Pakistan date arithmetic |
| `src/paths.ts` | Filesystem locations of the data files |
| `src/hijri/baseline.ts` | Umm al-Qura fallback conversion (never authoritative) |
| `src/hijri/overrides.ts` | Load and validate the confirmed-sighting record |
| `src/hijri/months.ts` | Month names, Ramadan predicate, month arithmetic |
| `src/hijri/resolve.ts` | Resolve one Gregorian day to a Hijri entry and assign confidence |
| `src/hijri/calendar.ts` | Assemble yearly calendar files and the index |
| `src/prayer/profiles.ts` | Calculation parameters per sect/school |
| `src/prayer/cities.ts` | Load and validate the city table |
| `src/prayer/compute.ts` | Compute one day of prayer times (adhan) |
| `src/prayer/generate.ts` | Assemble yearly prayer files |
| `src/client/calendar.ts` | `HijriCalendar` dataset + rollover-aware `hijriDate` |
| `src/client/prayer.ts` | `PrayerTable` + the Ramadan sehri/iftar gate |
| `src/watcher/candidates.ts` | The two candidate month starts + the polling-window gate |
| `src/watcher/sources.ts` | Fetch and normalise RSS articles (injected fetcher) |
| `src/watcher/extract.ts` | Match an article to a candidate date |
| `src/watcher/proposal.ts` | Turn agreement into an overrides update + PR description |
| `src/watcher/watcher.ts` | Orchestrate gate → poll → two-source agreement |
| `src/cli.ts` | Composition root: parse args, call modules, write files |
| `src/index.ts` | Package public surface (client + types) only |

`index.ts` files inside `src/hijri`, `src/prayer`, `src/client` and `src/watcher` are
barrels for their module's public surface. Internal code imports the concrete module,
not the barrel.
