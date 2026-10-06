/**
 * Load and validate the city table. Cities are plain data so contributors can
 * add rows through a pull request (proposal section 7.4).
 */
import { readFileSync } from "node:fs";
import type { City } from "../types.js";
import { CITIES_FILE } from "../paths.js";

export class CitiesValidationError extends Error {
  override name = "CitiesValidationError";
}

const TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));
const SLUG = /^[a-z][a-z0-9-]*$/;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseCities(input: unknown): City[] {
  if (!Array.isArray(input)) throw new CitiesValidationError("cities.json must be a JSON array");
  const cities: City[] = [];
  const seen = new Set<string>();

  input.forEach((raw, index) => {
    const context = `cities[${index}]`;
    if (typeof raw !== "object" || raw === null) {
      throw new CitiesValidationError(`${context} must be an object`);
    }
    const city = raw as Partial<City>;
    if (typeof city.id !== "string" || !SLUG.test(city.id)) {
      throw new CitiesValidationError(`${context}.id must be a lowercase slug`);
    }
    if (seen.has(city.id)) throw new CitiesValidationError(`${context}.id "${city.id}" is duplicated`);
    seen.add(city.id);
    if (typeof city.name !== "string" || city.name.length === 0) {
      throw new CitiesValidationError(`${context}.name is required`);
    }
    if (typeof city.province !== "string" || city.province.length === 0) {
      throw new CitiesValidationError(`${context}.province is required`);
    }
    if (!isFiniteNumber(city.latitude) || city.latitude < -90 || city.latitude > 90) {
      throw new CitiesValidationError(`${context}.latitude must be between -90 and 90`);
    }
    if (!isFiniteNumber(city.longitude) || city.longitude < -180 || city.longitude > 180) {
      throw new CitiesValidationError(`${context}.longitude must be between -180 and 180`);
    }
    if (!isFiniteNumber(city.elevation)) {
      throw new CitiesValidationError(`${context}.elevation must be a number (metres)`);
    }
    if (typeof city.timezone !== "string" || !TIMEZONES.has(city.timezone)) {
      throw new CitiesValidationError(`${context}.timezone must be a valid IANA timezone`);
    }
    cities.push({
      id: city.id,
      name: city.name,
      province: city.province,
      latitude: city.latitude,
      longitude: city.longitude,
      elevation: city.elevation,
      timezone: city.timezone,
    });
  });

  return cities;
}

export function loadCities(path: string = CITIES_FILE): City[] {
  const raw = readFileSync(path, "utf8");
  return parseCities(JSON.parse(raw));
}
