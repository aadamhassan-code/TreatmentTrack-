import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";
import { isStopMessage } from "@/lib/opt-out";

const TWIML_EMPTY = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

function twiml(status = 200) {
  return new NextResponse(TWIML_EMPTY, { status, headers: { "Content-Type": "text/xml" } });
}

/**
 * The public URL Twilio was configured to call. Twilio signs the exact URL
 * it requested, so this must match what's set in the Twilio console.
 */
function webhookUrl(): string {
  if (process.env.TWILIO_WEBHOOK_URL) return process.env.TWILIO_WEBHOOK_URL;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${site.replace(/\/$/, "")}/api/webhooks/twilio/inbound`;
}

/**
 * Point this at Twilio's "A message comes in" webhook for your SMS/WhatsApp
 * number. Every request must carry a valid Twilio signature, so nobody
 * else can post fake replies. An inbound STOP-family reply withdraws
 * consent immediately: the patient is marked opted out, the withdrawal is
 * appended to their consent history, and every pending message is
 * canceled — all in one database transaction (record_patient_opt_out).
 */
export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return NextResponse.json({ error: "Twilio is not configured" }, { status: 503 });
  }

  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });

  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!twilio.validateRequest(authToken, signature, webhookUrl(), params)) {
    return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
  }

  const from = params.From ?? "";
  if (!from || !isStopMessage(params.Body ?? "")) {
    return twiml();
  }

  const phone = normalizePhone(from.replace(/^whatsapp:/i, ""));
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("record_patient_opt_out", { p_phone: phone });

  if (error) {
    // Return an error rather than pretending it worked, so it shows up in
    // Twilio's error log (and triggers the Fallback URL if one is set) —
    // an opt-out must never be silently dropped.
    console.error("Failed to record opt-out", error);
    return twiml(500);
  }

  return twiml();
}
