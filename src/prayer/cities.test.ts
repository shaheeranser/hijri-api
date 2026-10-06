import { describe, expect, it } from "vitest";
import { CitiesValidationError, parseCities } from "./cities.js";

const valid = [
  {
    id: "karachi",
    name: "Karachi",
    province: "Sindh",
    latitude: 24.8607,
    longitude: 67.0011,
    elevation: 8,
    timezone: "Asia/Karachi",
  },
];

describe("parseCities", () => {
  it("accepts a valid table", () => {
    expect(parseCities(valid)).toHaveLength(1);
  });

  it("rejects an out-of-range latitude", () => {
    expect(() => parseCities([{ ...valid[0], latitude: 100 }])).toThrow(CitiesValidationError);
  });

  it("rejects a duplicate id", () => {
    expect(() => parseCities([...(valid as object[]), ...(valid as object[])])).toThrow(CitiesValidationError);
  });

  it("rejects an unknown timezone", () => {
    expect(() => parseCities([{ ...valid[0], timezone: "Mars/Olympus" }])).toThrow(CitiesValidationError);
  });
});
