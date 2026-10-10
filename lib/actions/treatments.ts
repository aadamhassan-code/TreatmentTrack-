"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTreatingDentists, requireCurrentPractice } from "@/lib/practice";
import { scheduleSequence } from "@/lib/sequence";
import { isTextableNumber, normalizePhone, ukDate } from "@/lib/utils";
import { OPEN_STATUSES, type TreatmentOutcome } from "@/lib/types";

export interface AddTreatmentResult {
  error?: string;
  /** The patient previously opted out; staff must confirm they've asked to hear from us again. */
  needsReconsent?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function addTreatment(formData: FormData): Promise<AddTreatmentResult> {
  const { userId, practice, role } = await requireCurrentPractice();
  const supabase = await createClient();

  // Dentist logins always add quotes as themselves; others may pick anyone
  // on the team who sees patients.
  let dentistUserId: string | null = role === "dentist" ? userId : String(formData.get("dentistUserId") ?? "") || null;
  if (dentistUserId && role !== "dentist") {
    const allowed = await listTreatingDentists(practice.id);
    if (!allowed.some((d) => d.userId === dentistUserId)) dentistUserId = null;
  }

  const patientName = String(formData.get("patientName") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? "").trim());
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const reconsent = formData.get("reconsent") === "on";
  const treatmentType = String(formData.get("treatmentType") ?? "").trim();
  const valuePounds = Number(formData.get("value") ?? 0);
  const quoteFollowupOffered = formData.get("quoteFollowupOffered") === "on";
  const crossSellConsent = formData.get("crossSellConsent") === "on";
  const futureIntentMonths = formData.get("futureIntentMonths")
    ? Number(formData.get("futureIntentMonths"))
    : null;

  if (!patientName || !phone || !treatmentType || !valuePounds || valuePounds <= 0) {
    return { error: "Please fill in patient name, phone, treatment type and a value." };
  }
  if (!isTextableNumber(phone)) {
    return { error: "That doesn't look like a mobile number. Follow-ups are sent by text, so please enter the patient's mobile (07…)." };
  }
  if (email && !EMAIL_RE.test(email)) {
    return { error: "That email address doesn't look right — please check it, or leave it blank." };
  }

  // The PECR soft opt-in rule: an automated sequence can only ever be set up
  // for a quote where the patient was offered an opt-out on this exact
  // quote. This is enforced again by a database trigger on `treatments` —
  // this check exists so the form fails with a clear message rather than a
  // raw database error.
  if (!quoteFollowupOffered) {
    return {
      error:
        "You must confirm the patient was offered an opt-out for follow-up on this quote before it can be added.",
    };
  }

  // Find-or-create the patient by phone within this practice.
  const { data: existingPatient } = await supabase
    .from("patients")
    .select("id, email, opted_out_at")
    .eq("practice_id", practice.id)
    .eq("phone", phone)
    .maybeSingle();

  let patientId = existingPatient?.id as string | undefined;

  // A patient who replied STOP can only be followed up again if they've
  // since asked the practice to contact them. Staff must say so explicitly;
  // that request is then recorded as fresh consent (and the database
  // refuses to clear an opt-out without it).
  if (existingPatient?.opted_out_at && !reconsent) {
    return {
      needsReconsent: true,
      error:
        "This patient opted out of follow-up messages. Only continue if they've since asked you to contact them again.",
    };
  }

  if (existingPatient && email && !existingPatient.email) {
    await supabase.from("patients").update({ email }).eq("id", existingPatient.id);
  }

  if (!patientId) {
    const { data: newPatient, error: patientError } = await supabase
      .from("patients")
      .insert({ practice_id: practice.id, full_name: patientName, phone, email })
      .select("id")
      .single();

    if (patientError || !newPatient) {
      return { error: "Couldn't save the patient record. Please try again." };
    }
    patientId = newPatient.id;
  }

  // Category (a): quote-followup consent — captured fresh for this quote.
  const { data: quoteConsent, error: quoteConsentError } = await supabase
    .from("consents")
    .insert({
      practice_id: practice.id,
      patient_id: patientId,
      category: "quote_followup",
      granted: true,
      captured_by: userId,
      notes: existingPatient?.opted_out_at
        ? `Patient previously opted out and has asked to hear from us again about a ${treatmentType} quote. Opt-out offered.`
        : `Opt-out offered for follow-up on ${treatmentType} quote.`,
    })
    .select("id")
    .single();

  if (quoteConsentError || !quoteConsent) {
    return { error: "Couldn't record quote-followup consent. Please try again." };
  }

  if (existingPatient?.opted_out_at) {
    const { error: clearError } = await supabase
      .from("patients")
      .update({ opted_out_at: null })
      .eq("id", existingPatient.id);
    if (clearError) {
      console.error("Failed to clear opt-out", clearError);
      return { error: "Couldn't update the patient's opt-out status. Please try again." };
    }
  }

  // Category (b): cross-sell consent — entirely separate, never inferred
  // from (a). Only recorded if the practice indicates the patient has
  // separately agreed to it.
  if (crossSellConsent) {
    await supabase.from("consents").insert({
      practice_id: practice.id,
      patient_id: patientId,
      category: "cross_sell",
      granted: true,
      captured_by: userId,
      notes: "Captured alongside treatment quote.",
    });
  }

  const isFutureIntent = futureIntentMonths != null;
  const futureIntentRemindAt = isFutureIntent
    ? addMonths(new Date(), futureIntentMonths!).toISOString().slice(0, 10)
    : null;

  const { data: treatment, error: treatmentError } = await supabase
    .from("treatments")
    .insert({
      practice_id: practice.id,
      patient_id: patientId,
      treatment_type: treatmentType,
      value_pence: Math.round(valuePounds * 100),
      status: isFutureIntent ? "future_intent" : "in_sequence",
      quoted_on: ukDate(),
      dentist_user_id: dentistUserId,
      quote_followup_consent_id: quoteConsent.id,
      future_intent_remind_at: futureIntentRemindAt,
      created_by: userId,
    })
    .select("id")
    .single();

  if (treatmentError || !treatment) {
    console.error("Failed to create treatment", treatmentError);
    return {
      error:
        "Couldn't create the treatment. This usually means the consent above wasn't recorded correctly — please try again.",
    };
  }

  if (!isFutureIntent) {
    try {
      await scheduleSequence(supabase, practice.id, treatment.id);
    } catch (e) {
      console.error(e);
    }
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

const OUTCOMES: readonly TreatmentOutcome[] = ["converted", "declined", "lost"];

/**
 * Closes a quote as Booked, Declined or Lost. The database stamps the date
 * and cancels any follow-up messages still waiting to go out.
 */
export async function setTreatmentOutcome(treatmentId: string, outcome: TreatmentOutcome) {
  if (!OUTCOMES.includes(outcome)) throw new Error("Unknown outcome");
  const { practice } = await requireCurrentPractice();
  const supabase = await createClient();

  const { error } = await supabase
    .from("treatments")
    .update({ status: outcome })
    .eq("id", treatmentId)
    .eq("practice_id", practice.id)
    .in("status", OPEN_STATUSES);

  if (error) {
    console.error("Failed to close treatment", error);
    throw new Error("Couldn't update that quote. Please try again.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

const DAY_MS = 86_400_000;

/**
 * Undo for Booked / Declined / Lost (e.g. a mis-click). Puts the quote back
 * in sequence and restores the follow-up messages that closing it
 * cancelled. If those were due in the meantime, they're all moved later by
 * the same amount so the next one goes tomorrow — never a burst of
 * overdue texts at once. Opt-out is still checked when each one is sent.
 */
export async function reopenTreatment(treatmentId: string) {
  const { practice } = await requireCurrentPractice();
  const supabase = await createClient();

  const { data: reopened, error } = await supabase
    .from("treatments")
    .update({ status: "in_sequence", converted_at: null, declined_at: null, lost_at: null })
    .eq("id", treatmentId)
    .eq("practice_id", practice.id)
    .in("status", ["converted", "declined", "lost"])
    .select("id");
  if (error || !reopened?.length) throw new Error("Couldn't reopen that quote. Please try again.");

  const { data: steps } = await supabase
    .from("sequence_steps")
    .select("id, scheduled_for")
    .eq("treatment_id", treatmentId)
    .eq("status", "canceled")
    .eq("error", "Quote closed")
    .order("scheduled_for");

  if (steps?.length) {
    const earliest = Date.parse(steps[0].scheduled_for);
    const shift = Math.max(0, Date.now() + DAY_MS - earliest);
    for (const step of steps) {
      await supabase
        .from("sequence_steps")
        .update({
          status: "pending",
          error: null,
          scheduled_for: new Date(Date.parse(step.scheduled_for) + shift).toISOString(),
        })
        .eq("id", step.id);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/reports");
}
