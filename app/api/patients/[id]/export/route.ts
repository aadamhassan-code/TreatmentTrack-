import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { needsSecondFactor } from "@/lib/mfa";

/**
 * Subject access request support: everything TreatmentTrack holds about one
 * patient, as a JSON file the practice can send on. Runs as the signed-in
 * user, so row-level security decides what's visible; owners and staff
 * only. Each export is written to the practice's audit log.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (await needsSecondFactor(supabase)) {
    return NextResponse.json({ error: "Enter your two-factor code first." }, { status: 401 });
  }

  const { data: role } = await supabase.rpc("current_practice_role");
  if (role !== "owner" && role !== "staff") {
    return NextResponse.json({ error: "Only owners and staff can export patient data." }, { status: 403 });
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, phone, email, opted_out_at, erased_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!patient) return NextResponse.json({ error: "Patient not found." }, { status: 404 });

  const [consents, treatments, visits, cases] = await Promise.all([
    supabase
      .from("consents")
      .select("category, granted, source, captured_at, notes")
      .eq("patient_id", id)
      .order("captured_at"),
    supabase
      .from("treatments")
      .select(
        "treatment_type, value_pence, status, quoted_on, created_at, converted_at, declined_at, lost_at, source, sequence_steps(step, channel, status, scheduled_for, sent_at)"
      )
      .eq("patient_id", id)
      .order("quoted_on"),
    supabase.from("visits").select("visit_type, suggested_treatment_type, suggestion_sent, created_at").eq("patient_id", id),
    supabase
      .from("cases")
      .select("treatment_type, value_pence, status, created_at, completed_at, note")
      .eq("patient_id", id),
  ]);

  await supabase.rpc("record_audit_event", {
    p_action: "patient_exported",
    p_subject: id,
    p_detail: null,
  });

  const body = {
    exported_at: new Date().toISOString(),
    exported_by: user.email,
    note:
      "Everything TreatmentTrack holds about this patient on behalf of the practice. Money values are in pence. TreatmentTrack does not hold clinical notes, radiographs or medical history.",
    patient,
    consent_history: consents.data ?? [],
    quotes_and_messages: treatments.data ?? [],
    visits: visits.data ?? [],
    treatment_cases: cases.data ?? [],
  };

  const safeName = String(patient.full_name).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="patient-${safeName}-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
