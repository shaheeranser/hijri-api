#!/usr/bin/env node
/**
 * CLI: generate the data files, or run the announcement watcher. A thin
 * composition root that parses arguments and calls the modules.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DateTime } from "luxon";
import { buildCalendar, loadOverrides, toHijri, type NormalizedOverrides } from "./hijri/index.js";
import { buildPrayerFiles, computeDay, getProfile, loadCities } from "./prayer/index.js";
import { PROFILE_IDS } from "./prayer/profiles.js";
import type { City, OverridesFile, PrayerProfile } from "./types.js";
import {
  DEFAULT_SOURCES,
  applyProposal,
  renderPullRequestBody,
  runWatcher,
  type WatcherOutcome,
} from "./watcher/index.js";
import { CALENDAR_DIR, CALENDAR_INDEX_FILE, OVERRIDES_FILE, PRAYER_DIR, REPO_ROOT } from "./paths.js";
import { todayInPakistan } from "./dates.js";

interface Args {
  command: string;
  flags: Map<string, string | true>;
}

function parseArgs(argv: string[]): Args {
  const first = argv[0];
  const command = first !== undefined && !first.startsWith("--") ? first : "generate";
  const rest = first !== undefined && first === command ? argv.slice(1) : argv;
  const flags = new Map<string, string | true>();
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index] as string;
    if (!token.startsWith("--")) continue;
    const [rawKey, inline] = token.slice(2).split("=", 2);
    const key = rawKey as string;
    if (inline !== undefined) {
      flags.set(key, inline);
    } else {
      const next = rest[index + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(key, next);
        index += 1;
      } else {
        flags.set(key, true);
      }
    }
  }
  return { command, flags };
}

function numberList(value: string | true | undefined): number[] | undefined {
  if (typeof value !== "string") return undefined;
  return value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part));
}

function stringFlag(flags: Map<string, string | true>, key: string): string | undefined {
  const value = flags.get(key);
  return typeof value === "string" ? value : undefined;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runGenerate(args: Args): void {
  const today = stringFlag(args.flags, "today") ?? todayInPakistan();
  const generatedAt = new Date().toISOString();
  const dryRun = args.flags.get("dry-run") === true;
  const overrides = loadOverrides();
  const suffix = dryRun ? " (dry run)" : "";

  const hijriYear = toHijri(today).year;
  const hijriYears = numberList(args.flags.get("hijri-years")) ?? [hijriYear, hijriYear + 1];
  const currentGregorianYear = Number(today.slice(0, 4));
  const gregorianYears = numberList(args.flags.get("years")) ?? [currentGregorianYear, currentGregorianYear + 1];

  if (args.flags.get("prayer") !== true) {
    const { files, index } = buildCalendar({ hijriYears, overrides, today, generatedAt });
    if (!dryRun) {
      for (const file of files) writeJson(join(CALENDAR_DIR, `${file.hijri_year}.json`), file);
      writeJson(CALENDAR_INDEX_FILE, index);
    }
    console.log(
      `calendar: ${files.length} file(s) for Hijri year(s) ${hijriYears.join(", ")}; ` +
        `${index.confirmed_days} confirmed day(s)${suffix}`,
    );
  }

  if (args.flags.get("calendar") !== true) {
    const cities = loadCities();
    const profiles = PROFILE_IDS.map(getProfile);
    const prayerFiles = buildPrayerFiles({ cities, profiles, years: gregorianYears, generatedAt });
    if (!dryRun) {
      for (const file of prayerFiles) {
        writeJson(join(PRAYER_DIR, file.city, file.profile, `${file.year}.json`), file);
      }
    }
    console.log(
      `prayer: ${prayerFiles.length} file(s) for ${cities.length} city/cities x ${profiles.length} profile(s) ` +
        `x year(s) ${gregorianYears.join(", ")}${suffix}`,
    );
  }
}

function loadRawOverrides(): OverridesFile {
  return JSON.parse(readFileSync(OVERRIDES_FILE, "utf8")) as OverridesFile;
}

function karachiMaghrib(city: City, profile: PrayerProfile): (date: string) => Date | undefined {
  return (date) => {
    const parsed = DateTime.fromISO(computeDay(city, profile, date).times.maghrib, { setZone: true });
    return parsed.isValid ? parsed.toJSDate() : undefined;
  };
}

async function runWatch(args: Args): Promise<number> {
  const overrides: NormalizedOverrides = loadOverrides();
  const cities = loadCities();
  const city = cities.find((item) => item.id === "karachi") ?? cities[0];
  if (city === undefined) {
    console.error("watch: no cities configured");
    return 1;
  }
  const now = stringFlag(args.flags, "now");
  const outcome = await runWatcher({
    overrides,
    now: now === undefined ? undefined : new Date(now),
    maghribFor: karachiMaghrib(city, getProfile("sunni_hanafi")),
    sources: DEFAULT_SOURCES,
  });
  return reportWatch(args, outcome);
}

function reportWatch(args: Args, outcome: WatcherOutcome): number {
  if (outcome.status === "proposed") {
    const body = renderPullRequestBody(outcome.proposal);
    console.log(`watch: proposed ${outcome.proposal.gregorian} as 1 of ${outcome.proposal.hijriKey}`);
    console.log(body);
    if (args.flags.get("write") === true) {
      writeJson(OVERRIDES_FILE, applyProposal(loadRawOverrides(), outcome.proposal));
      const outDir = join(REPO_ROOT, "watcher-out");
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "pull-request.md"), body, "utf8");
      console.log(`watch: wrote ${OVERRIDES_FILE} and watcher-out/pull-request.md`);
    } else {
      console.log("watch: dry run; pass --write to update overrides.json");
    }
    return 0;
  }

  console.log(`watch: ${outcome.status}${
    outcome.status === "not-due" || outcome.status === "no-baseline" ? ` (${outcome.reason})` : ""
  }`);
  if (outcome.status === "no-announcement" || outcome.status === "fetch-failed") {
    console.log(JSON.stringify(outcome, null, 2));
  }
  return outcome.status === "fetch-failed" || outcome.status === "no-baseline" ? 1 : 0;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "generate") {
    runGenerate(args);
    return;
  }
  if (args.command === "watch") {
    process.exitCode = await runWatch(args);
    return;
  }
  console.error(`Unknown command "${args.command}". Use "generate" or "watch".`);
  process.exitCode = 1;
}

void main();
