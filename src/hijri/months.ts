import type { HijriDate, MonthName } from "../types.js";

/** The twelve Hijri months with English and Urdu names. Index 0 is Muharram. */
export const HIJRI_MONTHS: readonly MonthName[] = [
  { en: "Muharram", ur: "محرم" },
  { en: "Safar", ur: "صفر" },
  { en: "Rabi al-Awwal", ur: "ربیع الاول" },
  { en: "Rabi al-Thani", ur: "ربیع الثانی" },
  { en: "Jumada al-Awwal", ur: "جمادی الاول" },
  { en: "Jumada al-Thani", ur: "جمادی الثانی" },
  { en: "Rajab", ur: "رجب" },
  { en: "Sha'ban", ur: "شعبان" },
  { en: "Ramadan", ur: "رمضان" },
  { en: "Shawwal", ur: "شوال" },
  { en: "Dhu al-Qi'dah", ur: "ذو القعدہ" },
  { en: "Dhu al-Hijjah", ur: "ذو الحجہ" },
];

export const RAMADAN_MONTH = 9;

/**
 * Spellings publishers actually use for each month: common romanisations plus
 * the Urdu name, used to recognise a headline as being about the target month.
 * Index 0 is Muharram. Never rely on a single transliteration.
 */
export const MONTH_NAME_VARIANTS: readonly (readonly string[])[] = [
  ["Muharram", "Moharram", "محرم"],
  ["Safar", "Saffar", "صفر"],
  ["Rabi al-Awwal", "Rabi-ul-Awwal", "Rabi ul Awwal", "Rabiul Awwal", "ربیع الاول"],
  ["Rabi al-Thani", "Rabi-ul-Thani", "Rabi us Sani", "Rabi ul-Sani", "ربیع الثانی"],
  ["Jumada al-Awwal", "Jumada al Awwal", "Jamadi ul Awwal", "Jamadi-ul-Awwal", "Jumadi-ul-Awwal", "جمادی الاول"],
  ["Jumada al-Thani", "Jumada al Thani", "Jamadi ul Thani", "Jamadi-ul-Thani", "جمادی الثانی"],
  ["Rajab", "رجب"],
  ["Sha'ban", "Shaban", "شعبان"],
  ["Ramadan", "Ramazan", "رمضان"],
  ["Shawwal", "شوال"],
  ["Dhu al-Qi'dah", "Zil Qadah", "Zilqad", "ذو القعدہ"],
  ["Dhu al-Hijjah", "Zil Hajj", "Zilhaj", "Dhul Hijjah", "ذو الحجہ"],
];

export function monthName(month: number): MonthName {
  const found = HIJRI_MONTHS[month - 1];
  return found ?? { en: `Month ${month}`, ur: "" };
}

/** Every known spelling of `month` (1-12), including the Urdu name. */
export function monthNameVariants(month: number): readonly string[] {
  return MONTH_NAME_VARIANTS[month - 1] ?? [];
}

export function isRamadan(month: number): boolean {
  return month === RAMADAN_MONTH;
}

/** The 1st of the month after `hijri`. */
export function nextHijriMonth(hijri: HijriDate): HijriDate {
  return hijri.month === 12
    ? { year: hijri.year + 1, month: 1, day: 1 }
    : { year: hijri.year, month: hijri.month + 1, day: 1 };
}
