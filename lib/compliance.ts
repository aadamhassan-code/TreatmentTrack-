import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cross-sell consent (category "b") must be on file for this specific
 * patient before any cross-sell-style suggestion or message is created.
 * This is checked here — server-side, at the point of creation and again
 * at send time — and is never inferred from quote-followup consent or
 * overridden by the practice-wide cross-sell toggle in settings.
 */
export async function hasCrossSellConsent(
  supabase: SupabaseClient,
  patientId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("consents")
    .select("granted")
    .eq("patient_id", patientId)
    .eq("category", "cross_sell")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.granted ?? false;
}

export async function isOptedOut(
  supabase: SupabaseClient,
  patientId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("patients")
    .select("opted_out_at")
    .eq("id", patientId)
    .single();

  if (error) throw error;
  return data?.opted_out_at != null;
}
