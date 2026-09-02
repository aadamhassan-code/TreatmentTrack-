"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentPractice } from "@/lib/practice";
import { scheduleSequence } from "@/lib/sequence";
import { normalizePhone } from "@/lib/utils";

export interface AddTreatmentResult {
  error?: string;
}

export async function addTreatment(formData: FormData): Promise<AddTreatmentResult> {
  const { userId, practice } = await requireCurrentPractice();
  const supabase = await createClient();

  const patientName = String(formData.get("patientName") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? "").trim());
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
    .select("id")
    .eq("practice_id", practice.id)
    .eq("phone", phone)
    .maybeSingle();

  let patientId = existingPatient?.id as string | undefined;

  if (!patientId) {
    const { data: newPatient, error: patientError } = await supabase
      .from("patients")
      .insert({ practice_id: practice.id, full_name: patientName, phone })
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
      notes: `Opt-out offered for follow-up on ${treatmentType} quote.`,
    })
    .select("id")
    .single();

  if (quoteConsentError || !quoteConsent) {
    return { error: "Couldn't record quote-followup consent. Please try again." };
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
      quote_followup_consent_id: quoteConsent.id,
      future_intent_remind_at: futureIntentRemindAt,
      created_by: userId,
    })
    .select("id")
    .single();

  if (treatmentError || !treatment) {
    return {
      error:
        "Couldn't create the treatment. This usually means the consent above wasn't recorded correctly — please try again.",
    };
  }

  if (!isFutureIntent) {
    await scheduleSequence(supabase, practice.id, treatment.id);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export async function markTreatmentBooked(treatmentId: string) {
  const { practice } = await requireCurrentPractice();
  const supabase = await createClient();

  await supabase
    .from("treatments")
    .update({ status: "converted", converted_at: new Date().toISOString() })
    .eq("id", treatmentId)
    .eq("practice_id", practice.id);

  await supabase
    .from("sequence_steps")
    .update({ status: "canceled" })
    .eq("treatment_id", treatmentId)
    .eq("status", "pending");

  revalidatePath("/dashboard");
}

export async function markTreatmentLost(treatmentId: string) {
  const { practice } = await requireCurrentPractice();
  const supabase = await createClient();

  await supabase
    .from("treatments")
    .update({ status: "lost", lost_at: new Date().toISOString() })
    .eq("id", treatmentId)
    .eq("practice_id", practice.id);

  await supabase
    .from("sequence_steps")
    .update({ status: "canceled" })
    .eq("treatment_id", treatmentId)
    .eq("status", "pending");

  revalidatePath("/dashboard");
}
