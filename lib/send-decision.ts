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
  /** Whether SMS / WhatsApp / email sending has been set up at all. */
  providerConfigured: boolean;
  /** When this message was due (ISO). */
  scheduledFor: string;
}

/** How long a due message waits for its channel to be connected before giving up. */
export const WAIT_FOR_PROVIDER_DAYS = 7;

export type SendDecision =
  | { action: "send"; to: string }
  | { action: "cancel"; reason: string }
  | { action: "skip_no_consent" }
  | { action: "fail"; reason: string }
  | { action: "wait" };

/**
 * Decides, at the moment of sending, whether one scheduled follow-up
 * message should actually go out. Everything is re-checked here rather
 * than trusted from when the sequence was scheduled days earlier.
 */
export function decideSend(step: StepToSend, now: Date = new Date()): SendDecision {
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

  // Sending isn't set up yet (e.g. Twilio not connected). Hold the message
  // for a few days so it goes once it is, rather than failing it outright —
  // but don't send something weeks late.
  if (!step.providerConfigured) {
    const ageDays = (now.getTime() - Date.parse(step.scheduledFor)) / 86_400_000;
    if (ageDays <= WAIT_FOR_PROVIDER_DAYS) return { action: "wait" };
    return {
      action: "fail",
      reason: `${CHANNEL_LABELS[step.channel]} sending wasn't connected within ${WAIT_FOR_PROVIDER_DAYS} days of this message being due`,
    };
  }

  return { action: "send", to };
}
