import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";

const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);

const TWIML_EMPTY = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

/**
 * Point this at Twilio's "A message comes in" webhook for your SMS/WhatsApp
 * number. An inbound STOP-family keyword withdraws consent immediately:
 * every pending sequence step for that patient is canceled before this
 * request even returns, and no further messages will be scheduled for
 * them until they're re-added with fresh consent.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const from = String(form.get("From") ?? "");
  const body = String(form.get("Body") ?? "").trim().toLowerCase();

  if (!from || !STOP_KEYWORDS.has(body)) {
    return new NextResponse(TWIML_EMPTY, { headers: { "Content-Type": "text/xml" } });
  }

  const supabase = createAdminClient();
  const phone = normalizePhone(from.replace(/^whatsapp:/i, ""));

  const { data: patients } = await supabase.from("patients").select("id").eq("phone", phone);

  for (const patient of patients ?? []) {
    await supabase
      .from("patients")
      .update({ opted_out_at: new Date().toISOString() })
      .eq("id", patient.id);

    const { data: treatments } = await supabase
      .from("treatments")
      .select("id")
      .eq("patient_id", patient.id);

    const treatmentIds = (treatments ?? []).map((t) => t.id);
    if (treatmentIds.length > 0) {
      await supabase
        .from("sequence_steps")
        .update({ status: "canceled" })
        .in("treatment_id", treatmentIds)
        .eq("status", "pending");
    }
  }

  return new NextResponse(TWIML_EMPTY, { headers: { "Content-Type": "text/xml" } });
}
