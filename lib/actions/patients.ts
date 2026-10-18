"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentPractice } from "@/lib/practice";

export interface ErasePatientResult {
  error?: string;
  erased?: boolean;
}

/**
 * Right to erasure. Owners and staff only (the database checks this too,
 * and that the patient belongs to the signed-in practice). Staff must type
 * the patient's name to confirm, because it can't be undone.
 */
export async function erasePatient(patientId: string, typedName: string): Promise<ErasePatientResult> {
  const { role } = await requireCurrentPractice();
  if (role === "dentist") return { error: "Only owners and staff can erase a patient." };

  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("full_name, erased_at")
    .eq("id", patientId)
    .maybeSingle();
  if (!patient) return { error: "Patient not found." };
  if (patient.erased_at) return { erased: true };
  if (typedName.trim().toLowerCase() !== String(patient.full_name).trim().toLowerCase()) {
    return { error: "The name you typed doesn't match. Type the patient's full name exactly as shown to confirm." };
  }

  const { error } = await supabase.rpc("erase_patient", { p_patient_id: patientId });
  if (error) {
    console.error("Erase patient failed", error);
    return { error: "Couldn't erase this patient. Please try again." };
  }

  revalidatePath("/patients");
  revalidatePath("/dashboard");
  revalidatePath("/cases");
  return { erased: true };
}
