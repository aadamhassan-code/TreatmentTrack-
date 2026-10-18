"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentPractice } from "@/lib/practice";

/** Writes a two-factor change to the practice's audit log. */
export async function recordMfaChange(action: "mfa_enrolled" | "mfa_removed"): Promise<void> {
  await requireCurrentPractice();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.rpc("record_audit_event", { p_action: action, p_subject: user?.id ?? null, p_detail: null });
}
