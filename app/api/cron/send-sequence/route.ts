import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getProvider, ensureOptOutText } from "@/lib/messaging";
import { renderTemplate } from "@/lib/utils";
import type { Channel, SequenceStep } from "@/lib/types";

interface DueStep {
  id: string;
  practice_id: string;
  step: SequenceStep;
  channel: Channel;
  treatment: {
    treatment_type: string;
    patient: { full_name: string; phone: string; email: string | null; opted_out_at: string | null };
  } | null;
  practice: { name: string } | null;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: dueSteps, error } = await supabase
    .from("sequence_steps")
    .select(
      "id, practice_id, step, channel, treatment:treatments(treatment_type, patient:patients(full_name, phone, email, opted_out_at)), practice:practices(name)"
    )
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const steps = (dueSteps ?? []) as unknown as DueStep[];
  if (steps.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, failed: 0, skipped: 0 });
  }

  const practiceIds = Array.from(new Set(steps.map((s) => s.practice_id)));
  const { data: templates } = await supabase
    .from("message_templates")
    .select("practice_id, step, channel, body")
    .in("practice_id", practiceIds);

  const templateMap = new Map(
    (templates ?? []).map((t) => [`${t.practice_id}:${t.step}:${t.channel}`, t.body])
  );

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const step of steps) {
    const patient = step.treatment?.patient;
    const practiceName = step.practice?.name;
    const treatmentType = step.treatment?.treatment_type;

    if (!patient || !practiceName || !treatmentType) {
      await supabase
        .from("sequence_steps")
        .update({ status: "failed", error: "Missing related treatment/patient data" })
        .eq("id", step.id);
      failed++;
      continue;
    }

    // Opt-out (or any withdrawal of consent) stops future messages
    // immediately — checked again here, at send time, not just when the
    // sequence was scheduled.
    if (patient.opted_out_at) {
      await supabase
        .from("sequence_steps")
        .update({ status: "skipped_no_consent" })
        .eq("id", step.id);
      skipped++;
      continue;
    }

    const template = templateMap.get(`${step.practice_id}:${step.step}:${step.channel}`);
    if (!template) {
      await supabase
        .from("sequence_steps")
        .update({ status: "failed", error: "No template configured for this step/channel" })
        .eq("id", step.id);
      failed++;
      continue;
    }

    const to = step.channel === "email" ? patient.email : patient.phone;
    if (!to) {
      await supabase
        .from("sequence_steps")
        .update({ status: "failed", error: `No ${step.channel} contact on file` })
        .eq("id", step.id);
      failed++;
      continue;
    }

    const rendered = renderTemplate(template, {
      patientName: patient.full_name,
      treatmentType,
      practiceName,
    });
    const body = ensureOptOutText(rendered, step.channel);

    const result = await getProvider(step.channel).send({ to, body });

    await supabase
      .from("sequence_steps")
      .update({
        status: result.ok ? "sent" : "failed",
        sent_at: result.ok ? new Date().toISOString() : null,
        provider_message_id: result.providerMessageId ?? null,
        error: result.error ?? null,
      })
      .eq("id", step.id);

    if (result.ok) sent++;
    else failed++;
  }

  return NextResponse.json({ processed: steps.length, sent, failed, skipped });
}
