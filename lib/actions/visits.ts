"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentPractice } from "@/lib/practice";
import { normalizePhone } from "@/lib/utils";
import { hasCrossSellConsent } from "@/lib/compliance";
import type { VisitType } from "@/lib/types";

export interface LogVisitResult {
  error?: string;
  outcome?: "no_suggestion" | "suggestion_sent" | "blocked_no_consent" | "blocked_disabled";
}

export async function logVisit(formData: FormData): Promise<LogVisitResult> {
  const { userId, practice } = await requireCurrentPractice();
  const supabase = await createClient();

  const patientName = String(formData.get("patientName") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? "").trim());
  const visitType = String(formData.get("visitType") ?? "").trim() as VisitType;
  const suggestedTreatmentType = String(formData.get("suggestedTreatmentType") ?? "").trim();

  if (!patientName || !phone || !visitType) {
    return { error: "Please fill in patient name, phone and visit type." };
  }

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

  let suggestionSent = false;
  let blockedReason: string | null = null;
  let outcome: LogVisitResult["outcome"] = "no_suggestion";

  if (suggestedTreatmentType) {
    const { data: settings } = await supabase
      .from("settings")
      .select("cross_sell_enabled")
      .eq("practice_id", practice.id)
      .single();

    if (!settings?.cross_sell_enabled) {
      blockedReason = "cross_sell_disabled";
      outcome = "blocked_disabled";
    } else {
      // Hard gate: category-(b) consent must be on file for THIS patient,
      // no matter what the practice-wide toggle says. This is not skipped
      // or overridden under any circumstance.
      const consented = await hasCrossSellConsent(supabase, patientId!);
      if (!consented) {
        blockedReason = "no_cross_sell_consent";
        outcome = "blocked_no_consent";
      } else {
        suggestionSent = true;
        outcome = "suggestion_sent";
      }
    }
  }

  const { error: visitError } = await supabase.from("visits").insert({
    practice_id: practice.id,
    patient_id: patientId,
    visit_type: visitType,
    suggested_treatment_type: suggestedTreatmentType || null,
    suggestion_sent: suggestionSent,
    blocked_reason: blockedReason,
    created_by: userId,
  });

  if (visitError) {
    return { error: "Couldn't save the visit. Please try again." };
  }

  revalidatePath("/visits/new");
  return { outcome };
}
