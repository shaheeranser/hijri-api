import { fileURLToPath } from "node:url";

/**
 * Root of the repository as resolved from this module. Works identically from
 * `src/` (tsx) and `dist/` (compiled) because both sit one level under root.
 */
export const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

export const DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));

export const CITIES_FILE = fileURLToPath(new URL("../data/cities.json", import.meta.url));

export const OVERRIDES_FILE = fileURLToPath(new URL("../data/hijri/overrides.json", import.meta.url));

export const CALENDAR_DIR = fileURLToPath(new URL("../data/hijri/calendar/", import.meta.url));

export const CALENDAR_INDEX_FILE = fileURLToPath(new URL("../data/hijri/index.json", import.meta.url));

export const PRAYER_DIR = fileURLToPath(new URL("../data/prayer/", import.meta.url));
