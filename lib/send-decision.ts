import type { Channel } from "@/lib/types";

const CHANNEL_LABELS: Record<Channel, string> = { sms: "SMS", whatsapp: "WhatsApp", email: "Email" };

export interface StepToSend {
  channel: Channel;
  practiceStatus: string | null;
  treatmentStatus: string | null;
  patient: { phone: string; email: string | null; opted_out_at: string | null } | null;
  /** Whether the practice currently has this channel switched on in Settings. */
  channelEnabled: boolean;
  hasTemplate: boolean;
}

export type SendDecision =
  | { action: "send"; to: string }
  | { action: "cancel"; reason: string }
  | { action: "skip_no_consent" }
  | { action: "fail"; reason: string };

/**
 * Decides, at the moment of sending, whether one scheduled follow-up
 * message should actually go out. Everything is re-checked here rather
 * than trusted from when the sequence was scheduled days earlier.
 */
export function decideSend(step: StepToSend): SendDecision {
  if (!step.patient) return { action: "fail", reason: "Missing related treatment/patient data" };

  // Opt-out always wins, whatever else is true.
  if (step.patient.opted_out_at) return { action: "skip_no_consent" };

  // Only practices with a live subscription send. "past_due" means Stripe
  // is still retrying a failed card payment, so we keep sending during
  // that grace period; canceled or never-paid practices don't.
  if (step.practiceStatus !== "active" && step.practiceStatus !== "past_due") {
    return { action: "cancel", reason: "Practice subscription is not active" };
  }

  // Booked/lost treatments cancel their own pending steps, but double-check
  // in case anything slipped through.
  if (step.treatmentStatus !== "in_sequence") {
    return { action: "cancel", reason: "Treatment is no longer being followed up" };
  }

  // Steps are scheduled days in advance; if the practice has since turned
  // this channel off in Settings, respect that now.
  if (!step.channelEnabled) {
    return { action: "cancel", reason: `${CHANNEL_LABELS[step.channel]} follow-up is turned off in Settings` };
  }

  if (!step.hasTemplate) return { action: "fail", reason: "No template configured for this step/channel" };

  const to = step.channel === "email" ? step.patient.email : step.patient.phone;
  if (!to) return { action: "fail", reason: `No ${step.channel} contact on file` };

  return { action: "send", to };
}
