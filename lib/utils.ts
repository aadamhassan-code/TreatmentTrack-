import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

/** Normalizes UK mobile numbers to E.164 so form entry and Twilio's
 *  inbound `From` field reliably match the same patient. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+44${digits.slice(1)}`;
  if (digits.startsWith("44")) return `+${digits}`;
  return digits;
}

export function renderTemplate(
  body: string,
  vars: { patientName: string; treatmentType: string; practiceName: string; dentistName?: string | null }
): string {
  return body
    .replaceAll("{dentistName}", vars.dentistName?.trim() || "your dentist")
    .replaceAll("{patientName}", vars.patientName)
    .replaceAll("{treatmentType}", vars.treatmentType)
    .replaceAll("{practiceName}", vars.practiceName);
}

/** "9 Oct 2026" from a "2026-10-09" date or an ISO timestamp. */
export function formatDate(value: string): string {
  const d = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(d);
}

/** The UK calendar date ("YYYY-MM-DD") of a moment — today by default. */
export function ukDate(at: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date(at));
}

/** Whole days between a "YYYY-MM-DD" quote date and today (UK time). */
export function daysSince(dateOnly: string, now: Date = new Date()): number {
  return Math.round((Date.parse(ukDate(now)) - Date.parse(dateOnly)) / 86_400_000);
}

/**
 * Whether a normalised (+44…) number can receive texts. UK mobiles are
 * +447 followed by 9 digits; UK landlines can't receive SMS. Other
 * countries' numbers are accepted if they look like a full number.
 */
export function isTextableNumber(e164: string): boolean {
  if (e164.startsWith("+44")) return /^\+447\d{9}$/.test(e164);
  return /^\+\d{10,15}$/.test(e164);
}

/** ISO timestamps a number of days either side of now, e.g. for "this week" windows. */
export function weekWindow(now: Date = new Date(), days = 7): { ahead: string; ago: string } {
  return {
    ahead: new Date(now.getTime() + days * 86_400_000).toISOString(),
    ago: new Date(now.getTime() - days * 86_400_000).toISOString(),
  };
}
