import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { scheduleSequence } from "@/lib/sequence";

/**
 * Starts follow-up for quotes that were paused or marked "not ready yet"
 * once their date arrives: the first message goes that day, the rest follow
 * the practice's schedule. The original
 * quote_followup consent captured at creation time still applies — it was
 * captured for this exact quote, not for "right now."
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error } = await supabase
    .from("treatments")
    .select("id, practice_id, patient:patients(opted_out_at), practice:practices(status)")
    .eq("status", "future_intent")
    .lte("future_intent_remind_at", today);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const treatments = (due ?? []) as unknown as {
    id: string;
    practice_id: string;
    patient: { opted_out_at: string | null } | null;
    practice: { status: string } | null;
  }[];

  let activated = 0;
  let skipped = 0;

  for (const treatment of treatments) {
    if (treatment.patient?.opted_out_at) {
      await supabase
        .from("treatments")
        .update({ status: "lost", lost_at: new Date().toISOString() })
        .eq("id", treatment.id);
      skipped++;
      continue;
    }

    // Leave it waiting (not lost) if the practice's subscription has
    // lapsed — it'll start once they're active again.
    const practiceStatus = treatment.practice?.status;
    if (practiceStatus !== "active" && practiceStatus !== "past_due") {
      skipped++;
      continue;
    }

    await supabase.from("treatments").update({ status: "in_sequence" }).eq("id", treatment.id);
    try {
      await scheduleSequence(supabase, treatment.practice_id, treatment.id, { startNow: true });
    } catch (e) {
      console.error(e);
    }
    activated++;
  }

  return NextResponse.json({ processed: treatments.length, activated, skipped });
}
