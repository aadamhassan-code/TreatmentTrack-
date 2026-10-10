import type { DentallyApi, DentallyPatient, DentallyTreatmentPlan, DentallyTreatmentPlanItem } from "@/lib/integrations/dentally";
import { isTextableNumber, normalizePhone, ukDate } from "@/lib/utils";
import { MAX_QUOTE_AGE_MONTHS } from "@/lib/import";

/** On the first sync, look back this far for unbooked plans. */
export const FIRST_SYNC_LOOKBACK_DAYS = 90;

export interface DentallyCandidate {
  externalPlanId: string;
  externalPatientId: string;
  /** The Dentally practitioner who made the plan, if any. */
  externalPractitionerId: string | null;
  patientName: string;
  phone: string | null;
  email: string | null;
  treatmentType: string;
  valuePence: number;
  quotedOn: string;
  /** Why this plan can't be followed up, or null if staff can start it. */
  blockedReason: string | null;
}

export interface DentallySyncPlan {
  candidates: DentallyCandidate[];
  /** Dentally plans that have been booked into the diary or started/completed. */
  bookedPlanIds: Set<string>;
}

const id = (v: number | string) => String(v);

/** An item has been put into an appointment, or done: the patient has gone ahead. */
const isBooked = (item: DentallyTreatmentPlanItem) => item.completed || item.treatment_appointment_id != null;

function describeTreatment(plan: DentallyTreatmentPlan, items: DentallyTreatmentPlanItem[]): string {
  const names = items
    .filter((i) => Number(i.price ?? 0) > 0)
    .sort((a, b) => Number(b.price ?? 0) - Number(a.price ?? 0))
    .map((i) => (i.patient_nomenclature || i.nomenclature || "").trim())
    .filter(Boolean);
  const unique = Array.from(new Set(names));
  if (unique.length === 0) return plan.nickname?.trim() || "Treatment plan";
  const shown = unique.slice(0, 2).join(" + ");
  return unique.length > 2 ? `${shown} + ${unique.length - 2} more` : shown;
}

function blockedReason(p: DentallyPatient, phone: string | null): string | null {
  // Dentally's marketing flag is the patient's own choice about promotional
  // contact; following up a quote is direct marketing under PECR, so a "no"
  // there is respected as an opt-out.
  if (p.marketing === false || p.marketing === 0) return "Marketing is switched off for this patient in Dentally";
  if (p.use_sms === false) return "This patient has asked not to receive texts (Dentally)";
  if (!phone) return "No valid mobile number in Dentally";
  return null;
}

function monthsBefore(today: string, months: number) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/**
 * Works out what's changed in Dentally since the last sync: unbooked
 * private treatment plans to offer staff for follow-up, and plans that have
 * since been booked (so their follow-up can stop). Reads only — the caller
 * saves the results.
 */
export async function planDentallySync(
  api: DentallyApi,
  opts: { since: string | null; now?: Date }
): Promise<DentallySyncPlan> {
  const now = opts.now ?? new Date();
  const today = ukDate(now);
  const since =
    opts.since ?? new Date(now.getTime() - FIRST_SYNC_LOOKBACK_DAYS * 86_400_000).toISOString();
  const oldest = monthsBefore(today, MAX_QUOTE_AGE_MONTHS);

  const bookedPlanIds = new Set<string>();

  // Anything booked or done since last time, across all plans.
  for (const item of await api.listTreatmentPlanItems({ updated_after: since })) {
    if (isBooked(item)) bookedPlanIds.add(id(item.treatment_plan_id));
  }
  for (const plan of await api.listTreatmentPlans({ updated_since: since, completed: true })) {
    bookedPlanIds.add(id(plan.id));
  }

  const openPlans = (await api.listTreatmentPlans({ updated_since: since, completed: false })).filter((plan) => {
    const quotedOn = (plan.start_date ?? ukDate(plan.created_at)).slice(0, 10);
    return Number(plan.private_treatment_value ?? 0) > 0 && quotedOn >= oldest && !bookedPlanIds.has(id(plan.id));
  });

  const patients = new Map<string, DentallyPatient>();
  const candidates: DentallyCandidate[] = [];

  for (const plan of openPlans) {
    const items = await api.listTreatmentPlanItems({ treatment_plan_id: id(plan.id) });
    if (items.some(isBooked)) {
      bookedPlanIds.add(id(plan.id));
      continue;
    }

    const patientId = id(plan.patient_id);
    let patient = patients.get(patientId);
    if (!patient) {
      patient = await api.getPatient(patientId);
      patients.set(patientId, patient);
    }
    if (!patient.active) continue;

    const normalised = patient.mobile_phone ? normalizePhone(patient.mobile_phone) : "";
    const phone = isTextableNumber(normalised) ? normalised : null;

    candidates.push({
      externalPlanId: id(plan.id),
      externalPatientId: patientId,
      externalPractitionerId: plan.practitioner_id != null ? id(plan.practitioner_id) : null,
      patientName: [patient.first_name, patient.last_name].filter(Boolean).join(" ").trim() || "Unknown patient",
      phone,
      email: patient.use_email === false ? null : patient.email_address?.trim().toLowerCase() || null,
      treatmentType: describeTreatment(plan, items),
      valuePence: Math.round(Number(plan.private_treatment_value) * 100),
      quotedOn: (plan.start_date ?? ukDate(plan.created_at)).slice(0, 10),
      blockedReason: blockedReason(patient, phone),
    });
  }

  return { candidates, bookedPlanIds };
}
