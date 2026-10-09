import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel, SequenceStep } from "@/lib/types";

export const SEQUENCE_STEPS: { step: SequenceStep; days: number }[] = [
  { step: "day_3", days: 3 },
  { step: "day_7", days: 7 },
  { step: "day_14", days: 14 },
  { step: "day_30", days: 30 },
];

/**
 * Creates the pending sequence_steps rows for one or more treatments, one per
 * (step, channel) pair the practice has both enabled and has a template
 * for. Used both right after a treatment is created and when a
 * future-intent reminder converts into an active sequence.
 */
export async function scheduleSequence(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  practiceId: string,
  treatmentIds: string | string[]
) {
  const ids = Array.isArray(treatmentIds) ? treatmentIds : [treatmentIds];
  if (ids.length === 0) return;

  const [{ data: settings }, { data: templates }] = await Promise.all([
    supabase.from("settings").select("*").eq("practice_id", practiceId).single(),
    supabase.from("message_templates").select("step, channel").eq("practice_id", practiceId),
  ]);

  const enabledChannels = new Set<Channel>(
    [
      settings?.sms_enabled && "sms",
      settings?.whatsapp_enabled && "whatsapp",
      settings?.email_enabled && "email",
    ].filter(Boolean) as Channel[]
  );

  const availableTemplates = new Set(
    (templates ?? []).map((t: { step: string; channel: string }) => `${t.step}:${t.channel}`)
  );

  const now = Date.now();
  const rows = ids.flatMap((treatmentId) =>
    SEQUENCE_STEPS.flatMap(({ step, days }) =>
      Array.from(enabledChannels)
        .filter((channel) => availableTemplates.has(`${step}:${channel}`))
        .map((channel) => ({
          treatment_id: treatmentId,
          practice_id: practiceId,
          step,
          channel,
          scheduled_for: new Date(now + days * 24 * 60 * 60 * 1000).toISOString(),
        }))
    )
  );

  if (rows.length > 0) {
    const { error } = await supabase.from("sequence_steps").insert(rows);
    if (error) throw new Error(`Couldn't schedule follow-up messages: ${error.message}`);
  }
}
