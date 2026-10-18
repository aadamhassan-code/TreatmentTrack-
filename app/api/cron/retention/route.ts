import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

/**
 * Nightly UK GDPR storage limitation: erases patients who have nothing open
 * and have been inactive for longer than their practice's retention period
 * (Settings → Privacy & security; two years by default). Each erasure is
 * written to that practice's audit log.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("apply_retention");
  if (error) {
    console.error("Retention run failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ erased: data ?? 0 });
}
