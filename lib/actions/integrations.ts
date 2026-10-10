"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCurrentPractice, requireOwner } from "@/lib/practice";
import { encryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { createDentallyClient, type DentallyRegion } from "@/lib/integrations/dentally";
import { friendlyDentallyError, runDentallySync, type IntegrationRow } from "@/lib/integrations/run-sync";
import { saveQuotes } from "@/lib/quotes";
import { ukDate } from "@/lib/utils";

export interface IntegrationActionResult {
  error?: string;
  message?: string;
}

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/treatments/dentally");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

function syncMessage(newCandidates: number, autoBooked: number) {
  const parts = [
    newCandidates
      ? `${newCandidates} new unbooked treatment plan${newCandidates === 1 ? "" : "s"} to review`
      : "no new unbooked treatment plans",
  ];
  if (autoBooked) parts.push(`${autoBooked} quote${autoBooked === 1 ? "" : "s"} marked Booked because ${autoBooked === 1 ? "it was" : "they were"} booked in Dentally`);
  return `Synced with Dentally: ${parts.join(", and ")}.`;
}

/** Owner pastes a Dentally API key; we check it works before saving it (encrypted). */
export async function connectDentally(formData: FormData): Promise<IntegrationActionResult> {
  const { practice, userId } = await requireOwner();
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const region = (formData.get("region") === "sandbox" ? "sandbox" : "uk") as DentallyRegion;

  if (!apiKey) return { error: "Please paste your Dentally API key." };
  if (!isEncryptionConfigured()) {
    return { error: "TreatmentTrack isn't set up to store API keys yet (INTEGRATIONS_ENCRYPTION_KEY is missing). Please contact support." };
  }

  let label: string;
  try {
    const user = await createDentallyClient(apiKey, region).getUser();
    label = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Dentally user";
  } catch (e) {
    return { error: friendlyDentallyError(e) };
  }

  const admin = createAdminClient();
  const { data: integration, error } = await admin
    .from("integrations")
    .upsert(
      {
        practice_id: practice.id,
        provider: "dentally",
        region,
        encrypted_api_key: encryptSecret(apiKey),
        account_label: label,
        last_synced_at: null,
        last_sync_error: null,
        created_by: userId,
      },
      { onConflict: "practice_id,provider" }
    )
    .select("id, practice_id, region, encrypted_api_key, last_synced_at")
    .single();

  if (error || !integration) {
    console.error("Saving Dentally integration failed", error);
    return { error: "Couldn't save the connection. Please try again." };
  }

  const result = await runDentallySync(admin, integration as IntegrationRow);
  refresh();
  return result.ok
    ? { message: `Connected as ${label}. ${syncMessage(result.newCandidates, result.autoBooked)}` }
    : { message: `Connected as ${label}, but the first sync had a problem: ${result.error}` };
}

export async function disconnectDentally(): Promise<IntegrationActionResult> {
  const { practice } = await requireOwner();
  const admin = createAdminClient();
  // Deletes the stored key. Quotes already being followed up carry on;
  // they just won't be closed automatically when booked in Dentally.
  await admin.from("integrations").delete().eq("practice_id", practice.id).eq("provider", "dentally");
  await admin
    .from("pms_quote_candidates")
    .update({ status: "dismissed" })
    .eq("practice_id", practice.id)
    .eq("provider", "dentally")
    .eq("status", "pending");
  refresh();
  return { message: "Dentally has been disconnected and its API key deleted." };
}

/** Anyone in the practice can ask for an immediate sync. */
export async function syncDentallyNow(): Promise<IntegrationActionResult> {
  const { practice } = await requireCurrentPractice();
  const admin = createAdminClient();
  const { data: integration } = await admin
    .from("integrations")
    .select("id, practice_id, region, encrypted_api_key, last_synced_at")
    .eq("practice_id", practice.id)
    .eq("provider", "dentally")
    .maybeSingle();
  if (!integration) return { error: "Dentally isn't connected. An owner can connect it in Settings." };

  const result = await runDentallySync(admin, integration as IntegrationRow);
  refresh();
  return result.ok ? { message: syncMessage(result.newCandidates, result.autoBooked) } : { error: result.error };
}

/**
 * Starts follow-up for treatment plans found in Dentally, once staff have
 * confirmed each patient was offered an opt-out for follow-up on that plan.
 * Saved exactly like Add Treatment / CSV import, with a consent record each.
 */
export async function startDentallyQuotes(ids: string[], optOutConfirmed: boolean): Promise<IntegrationActionResult> {
  const { practice, userId } = await requireCurrentPractice();
  if (!optOutConfirmed) {
    return { error: "Please confirm each selected patient was offered an opt-out for follow-up on their treatment plan." };
  }
  if (ids.length === 0) return { error: "Select at least one treatment plan." };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("pms_quote_candidates")
    .select("*")
    .eq("practice_id", practice.id)
    .eq("status", "pending")
    .is("blocked_reason", null)
    .in("id", ids.slice(0, 500));
  if (error) return { error: "Couldn't load those treatment plans. Please try again." };

  const today = ukDate();
  const result = await saveQuotes(supabase, {
    practiceId: practice.id,
    userId,
    source: "dentally",
    consentNote: (q) =>
      `From Dentally treatment plan ${q.externalId} on ${today}. Staff confirmed an opt-out was offered for follow-up on this ${q.treatmentType} plan.`,
    quotes: (rows ?? [])
      .filter((r) => r.phone)
      .map((r) => ({
        key: r.id as string,
        patientName: r.patient_name,
        phone: r.phone,
        email: r.email,
        treatmentType: r.treatment_type,
        valuePence: r.value_pence,
        quotedOn: r.quoted_on,
        externalId: r.external_plan_id,
        dentistUserId: r.dentist_user_id ?? null,
      })),
  });
  if (result.error) return { error: result.error };

  for (const s of result.saved) {
    await supabase.from("pms_quote_candidates").update({ status: "started", treatment_id: s.treatmentId }).eq("id", s.key);
  }

  refresh();
  const started = result.saved.length;
  const notes = result.skipped.map((s) => {
    const row = rows?.find((r) => r.id === s.key);
    return `${row?.patient_name ?? "A patient"}: ${s.reason}`;
  });
  return {
    message:
      `Started follow-up for ${started} treatment plan${started === 1 ? "" : "s"}.` +
      (notes.length ? ` Not started — ${notes.join("; ")}` : ""),
  };
}

export async function dismissDentallyQuotes(ids: string[]): Promise<IntegrationActionResult> {
  const { practice } = await requireCurrentPractice();
  const supabase = await createClient();
  const { error } = await supabase
    .from("pms_quote_candidates")
    .update({ status: "dismissed" })
    .eq("practice_id", practice.id)
    .eq("status", "pending")
    .in("id", ids);
  if (error) return { error: "Couldn't dismiss those. Please try again." };
  refresh();
  return { message: `Dismissed ${ids.length} treatment plan${ids.length === 1 ? "" : "s"}.` };
}
