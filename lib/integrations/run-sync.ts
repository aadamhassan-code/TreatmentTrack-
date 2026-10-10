import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { createDentallyClient, DentallyError, type DentallyApi, type DentallyRegion } from "@/lib/integrations/dentally";
import { planDentallySync } from "@/lib/integrations/dentally-sync";
import { OPEN_STATUSES } from "@/lib/types";

type Admin = ReturnType<typeof createAdminClient>;

export interface IntegrationRow {
  id: string;
  practice_id: string;
  region: DentallyRegion;
  encrypted_api_key: string;
  last_synced_at: string | null;
}

export interface SyncSummary {
  ok: boolean;
  error?: string;
  newCandidates: number;
  autoBooked: number;
}

/**
 * Works out which TreatmentTrack team member each Dentally practitioner is:
 * an owner's explicit link on the Team page first, otherwise matching
 * email addresses. Only people quotes can be assigned to are considered.
 */
async function practitionerToDentist(
  admin: Admin,
  api: DentallyApi,
  practiceId: string,
  practitionerIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (practitionerIds.length === 0) return map;

  const { data: members } = await admin
    .from("practice_members")
    .select("user_id, role, treats_patients, dentally_practitioner_id")
    .eq("practice_id", practiceId);
  const treating = (members ?? []).filter((m) => m.role === "dentist" || m.treats_patients);

  for (const m of treating) if (m.dentally_practitioner_id) map.set(String(m.dentally_practitioner_id), m.user_id);
  const unmatched = practitionerIds.filter((p) => !map.has(p));
  if (unmatched.length === 0) return map;

  const emails = new Map<string, string>();
  for (const m of treating.filter((m) => !m.dentally_practitioner_id)) {
    const { data } = await admin.auth.admin.getUserById(m.user_id);
    if (data.user?.email) emails.set(data.user.email.toLowerCase(), m.user_id);
  }
  if (emails.size === 0) return map;

  for (const p of await api.listPractitioners()) {
    const email = p.user?.email?.toLowerCase();
    const userId = email ? emails.get(email) : undefined;
    if (userId && unmatched.includes(String(p.id))) map.set(String(p.id), userId);
  }
  return map;
}

export function friendlyDentallyError(e: unknown): string {
  if (e instanceof DentallyError) {
    if (e.status === 401) return "Dentally didn't accept the API key. It may have been deleted or expired — please reconnect.";
    if (e.status === 403) return "The API key doesn't have permission to read patients and treatment plans. Create a key with those permissions and reconnect.";
    if (e.status === 429) return "Dentally's hourly request limit was reached. The next sync will carry on.";
    return `Dentally returned an error: ${e.message}`;
  }
  return "Couldn't reach Dentally. The next sync will try again.";
}

/**
 * One practice's Dentally sync, run by the daily cron or the "Sync now"
 * button. Uses the service role because the cron has no signed-in user;
 * callers from a request must have checked the user belongs to the practice.
 *
 * - New unbooked private plans are added to the "From Dentally" list for
 *   staff to review. Nothing is messaged until staff confirm consent.
 * - Plans booked into the Dentally diary (or started/completed) close the
 *   matching quote here as Booked, which cancels its pending messages.
 */
export async function runDentallySync(admin: Admin, integration: IntegrationRow, now = new Date()): Promise<SyncSummary> {
  const startedAt = now.toISOString();
  try {
    const api = createDentallyClient(decryptSecret(integration.encrypted_api_key), integration.region);
    const plan = await planDentallySync(api, { since: integration.last_synced_at, now });
    const practiceId = integration.practice_id;
    const dentistFor = await practitionerToDentist(
      admin,
      api,
      practiceId,
      Array.from(new Set(plan.candidates.map((c) => c.externalPractitionerId).filter((p): p is string => !!p)))
    );

    // Candidates: add new ones; refresh details of ones still waiting for
    // review; never resurrect ones staff already started or dismissed.
    let newCandidates = 0;
    const planIds = plan.candidates.map((c) => c.externalPlanId);
    const { data: existing } = planIds.length
      ? await admin
          .from("pms_quote_candidates")
          .select("external_plan_id, status")
          .eq("practice_id", practiceId)
          .eq("provider", "dentally")
          .in("external_plan_id", planIds)
      : { data: [] };
    const existingStatus = new Map((existing ?? []).map((r) => [r.external_plan_id, r.status]));

    for (const c of plan.candidates) {
      const row = {
        practice_id: practiceId,
        provider: "dentally",
        external_plan_id: c.externalPlanId,
        external_patient_id: c.externalPatientId,
        patient_name: c.patientName,
        phone: c.phone,
        email: c.email,
        treatment_type: c.treatmentType,
        value_pence: c.valuePence,
        quoted_on: c.quotedOn,
        blocked_reason: c.blockedReason,
        external_practitioner_id: c.externalPractitionerId,
        dentist_user_id: c.externalPractitionerId ? (dentistFor.get(c.externalPractitionerId) ?? null) : null,
      };
      const status = existingStatus.get(c.externalPlanId);
      if (!status) {
        const { error } = await admin.from("pms_quote_candidates").insert(row);
        if (error) throw new Error(`Saving candidate failed: ${error.message}`);
        newCandidates++;
      } else if (status === "pending") {
        await admin
          .from("pms_quote_candidates")
          .update(row)
          .eq("practice_id", practiceId)
          .eq("provider", "dentally")
          .eq("external_plan_id", c.externalPlanId);
      }
    }

    // Bookings: close the quote here and stop its messages.
    let autoBooked = 0;
    const booked = Array.from(plan.bookedPlanIds);
    for (let i = 0; i < booked.length; i += 200) {
      const batch = booked.slice(i, i + 200);
      const { data: closed, error } = await admin
        .from("treatments")
        .update({ status: "converted" })
        .eq("practice_id", practiceId)
        .eq("source", "dentally")
        .in("external_id", batch)
        .in("status", OPEN_STATUSES)
        .select("id");
      if (error) throw new Error(`Closing booked quotes failed: ${error.message}`);
      autoBooked += closed?.length ?? 0;

      await admin
        .from("pms_quote_candidates")
        .update({ status: "booked" })
        .eq("practice_id", practiceId)
        .eq("provider", "dentally")
        .eq("status", "pending")
        .in("external_plan_id", batch);
    }

    await admin
      .from("integrations")
      .update({ last_synced_at: startedAt, last_sync_error: null })
      .eq("id", integration.id);

    return { ok: true, newCandidates, autoBooked };
  } catch (e) {
    console.error("Dentally sync failed", integration.practice_id, e);
    const message = friendlyDentallyError(e);
    await admin.from("integrations").update({ last_sync_error: message }).eq("id", integration.id);
    return { ok: false, error: message, newCandidates: 0, autoBooked: 0 };
  }
}
