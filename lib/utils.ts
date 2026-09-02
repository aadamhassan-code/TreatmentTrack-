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
  vars: { patientName: string; treatmentType: string; practiceName: string }
): string {
  return body
    .replaceAll("{patientName}", vars.patientName)
    .replaceAll("{treatmentType}", vars.treatmentType)
    .replaceAll("{practiceName}", vars.practiceName);
}
