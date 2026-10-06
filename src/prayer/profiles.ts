/**
 * Prayer calculation parameters for each supported sect/school profile.
 * See proposal sections 7.2 and 7.3.
 */
import type { ProfileId, PrayerAdjustments, PrayerProfile } from "../types.js";

const NO_ADJUSTMENTS: PrayerAdjustments = {
  fajr: 0,
  sunrise: 0,
  dhuhr: 0,
  asr: 0,
  maghrib: 0,
  isha: 0,
};

export const PROFILES: Record<ProfileId, PrayerProfile> = {
  sunni_hanafi: {
    id: "sunni_hanafi",
    label: "Sunni (Hanafi)",
    fajrAngle: 18,
    ishaAngle: 18,
    asrFactor: 2,
    maghrib: { type: "sunset" },
    sehriOffsetMin: 0,
    iftarOffsetMin: 0,
    adjustMin: { ...NO_ADJUSTMENTS },
  },
  sunni_asr1: {
    id: "sunni_asr1",
    label: "Sunni (earlier Asr)",
    fajrAngle: 18,
    ishaAngle: 18,
    asrFactor: 1,
    maghrib: { type: "sunset" },
    sehriOffsetMin: 0,
    iftarOffsetMin: 0,
    adjustMin: { ...NO_ADJUSTMENTS },
  },
  shia_jafari: {
    id: "shia_jafari",
    label: "Shia (Jafari)",
    fajrAngle: 16,
    ishaAngle: 14,
    asrFactor: 1,
    // The 4 degree rule already lands ~15 minutes after sunset at Pakistani
    // latitudes, so we do not also add a fixed offset (proposal section 7.2).
    maghrib: { type: "angle", value: 4 },
    // A precaution margin before Fajr, as printed Shia timetables do.
    sehriOffsetMin: -10,
    iftarOffsetMin: 0,
    adjustMin: { ...NO_ADJUSTMENTS },
  },
};

export const PROFILE_IDS = Object.keys(PROFILES) as ProfileId[];

export function getProfile(id: ProfileId): PrayerProfile {
  return PROFILES[id];
}
