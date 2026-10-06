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

export function monthName(month: number): MonthName {
  const found = HIJRI_MONTHS[month - 1];
  return found ?? { en: `Month ${month}`, ur: "" };
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
