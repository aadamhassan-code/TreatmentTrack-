import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runDentallySync, type IntegrationRow } from "@/lib/integrations/run-sync";

/**
 * Syncs every connected practice management system. Scheduled at 07:30,
 * before the 08:00 send-sequence run, so patients who booked in Dentally
 * overnight are closed before their next follow-up message goes out.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: integrations, error } = await admin
    .from("integrations")
    .select("id, practice_id, region, encrypted_api_key, last_synced_at, practice:practices(status)")
    .eq("provider", "dentally");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let synced = 0;
  let failed = 0;
  let newCandidates = 0;
  let autoBooked = 0;

  for (const row of integrations ?? []) {
    const practice = row.practice as unknown as { status: string } | null;
    if (practice?.status !== "active" && practice?.status !== "past_due") continue;
    const result = await runDentallySync(admin, row as unknown as IntegrationRow);
    if (result.ok) synced++;
    else failed++;
    newCandidates += result.newCandidates;
    autoBooked += result.autoBooked;
  }

  return NextResponse.json({ synced, failed, newCandidates, autoBooked });
}
