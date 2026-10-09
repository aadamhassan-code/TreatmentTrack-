import type { Treatment } from "@/lib/types";

export type DisplayStatus = Treatment["status"] | "opted_out" | "messages_finished";

/**
 * What the dashboard should call a treatment. The stored status says whether
 * the practice still considers the quote open; this also reflects whether any
 * follow-up messages are actually still going to be sent for it.
 */
export function displayStatus(
  t: Pick<Treatment, "status" | "patient" | "sequence_steps">
): DisplayStatus {
  if (t.status !== "in_sequence") return t.status;
  if (t.patient?.opted_out_at) return "opted_out";

  const steps = t.sequence_steps ?? [];
  if (steps.length === 0 || steps.some((s) => s.status === "pending")) return "in_sequence";

  // Every message has been dealt with. If the patient's STOP reply cancelled
  // them, say so — even if they've since re-consented for a different quote.
  if (steps.some((s) => s.status === "canceled" && s.error === "Patient opted out")) {
    return "opted_out";
  }
  return "messages_finished";
}
