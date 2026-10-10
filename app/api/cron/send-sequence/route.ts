import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getProvider, ensureOptOutText } from "@/lib/messaging";
import { renderTemplate } from "@/lib/utils";
import { decideSend } from "@/lib/send-decision";
import type { Channel, SequenceStep } from "@/lib/types";

interface DueStep {
  id: string;
  practice_id: string;
  step: SequenceStep;
  channel: Channel;
  scheduled_for: string;
  treatment: {
    treatment_type: string;
    status: string;
    dentist_user_id: string | null;
    patient: { full_name: string; phone: string; email: string | null; opted_out_at: string | null };
  } | null;
  practice: {
    name: string;
    status: string;
    requires_owner_approval: boolean;
    owner_approved_at: string | null;
  } | null;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: dueSteps, error } = await supabase
    .from("sequence_steps")
    .select(
      "id, practice_id, step, channel, scheduled_for, treatment:treatments(treatment_type, status, dentist_user_id, patient:patients(full_name, phone, email, opted_out_at)), practice:practices(name, status, requires_owner_approval, owner_approved_at)"
    )
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const steps = (dueSteps ?? []) as unknown as DueStep[];
  if (steps.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, failed: 0, skipped: 0, canceled: 0 });
  }

  const practiceIds = Array.from(new Set(steps.map((s) => s.practice_id)));
  const { data: templates } = await supabase
    .from("message_templates")
    .select("practice_id, step, channel, body")
    .in("practice_id", practiceIds);

  const { data: practiceSettings } = await supabase
    .from("settings")
    .select("practice_id, sms_enabled, whatsapp_enabled, email_enabled")
    .in("practice_id", practiceIds);

  const settingsMap = new Map((practiceSettings ?? []).map((s) => [s.practice_id, s]));

  // Names for {dentistName}, as set on each practice's Team page.
  const { data: members } = await supabase
    .from("practice_members")
    .select("practice_id, user_id, display_name")
    .in("practice_id", practiceIds);
  const dentistNames = new Map((members ?? []).map((m) => [`${m.practice_id}:${m.user_id}`, m.display_name as string | null]));

  const templateMap = new Map(
    (templates ?? []).map((t) => [`${t.practice_id}:${t.step}:${t.channel}`, t.body])
  );

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let canceled = 0;
  let waiting = 0;

  for (const step of steps) {
    const template = templateMap.get(`${step.practice_id}:${step.step}:${step.channel}`);
    const decision = decideSend({
      channel: step.channel,
      practiceStatus: step.practice?.status ?? null,
      treatmentStatus: step.treatment?.status ?? null,
      patient: step.treatment?.patient ?? null,
      channelEnabled: Boolean(settingsMap.get(step.practice_id)?.[`${step.channel}_enabled`]),
      hasTemplate: Boolean(template),
      providerConfigured: getProvider(step.channel).isConfigured(),
      scheduledFor: step.scheduled_for,
      awaitingOwnerApproval: Boolean(step.practice?.requires_owner_approval && !step.practice.owner_approved_at),
    });

    if (decision.action === "wait") {
      waiting++;
      continue;
    }

    if (decision.action === "skip_no_consent") {
      await supabase.from("sequence_steps").update({ status: "skipped_no_consent" }).eq("id", step.id);
      skipped++;
      continue;
    }
    if (decision.action === "cancel") {
      await supabase
        .from("sequence_steps")
        .update({ status: "canceled", error: decision.reason })
        .eq("id", step.id);
      canceled++;
      continue;
    }
    if (decision.action === "fail") {
      await supabase
        .from("sequence_steps")
        .update({ status: "failed", error: decision.reason })
        .eq("id", step.id);
      failed++;
      continue;
    }

    const rendered = renderTemplate(template!, {
      patientName: step.treatment!.patient.full_name,
      treatmentType: step.treatment!.treatment_type,
      practiceName: step.practice!.name,
      dentistName: step.treatment!.dentist_user_id
        ? dentistNames.get(`${step.practice_id}:${step.treatment!.dentist_user_id}`)
        : null,
    });
    const body = ensureOptOutText(rendered, step.channel);

    const result = await getProvider(step.channel).send({ to: decision.to, body });

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

  return NextResponse.json({ processed: steps.length, sent, failed, skipped, canceled, waiting });
}
