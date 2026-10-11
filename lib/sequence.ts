import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel } from "@/lib/types";
import { DEFAULT_SEQUENCE_DAYS, planSchedule } from "@/lib/schedule";

/**
 * Creates the pending sequence_steps rows for one or more treatments,
 * following the practice's follow-up schedule (Settings): one row per
 * (message, channel) the practice has both enabled and has wording for.
 * Used right after a quote is added, and when a paused or "not ready yet"
 * quote starts — then `startNow` sends the first message that day and keeps
 * the spacing for the rest.
 */
export async function scheduleSequence(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  practiceId: string,
  treatmentIds: string | string[],
  opts: { startNow?: boolean } = {}
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
    (templates ?? []).map((t: { step: number; channel: string }) => `${t.step}:${t.channel}`)
  );

  const days: number[] = settings?.sequence_days?.length ? settings.sequence_days : DEFAULT_SEQUENCE_DAYS;
  const plan = planSchedule(days, new Date(), opts);

  const rows = ids.flatMap((treatmentId) =>
    plan.flatMap(({ step, at }) =>
      Array.from(enabledChannels)
        .filter((channel) => availableTemplates.has(`${step}:${channel}`))
        .map((channel) => ({
          treatment_id: treatmentId,
          practice_id: practiceId,
          step,
          channel,
          scheduled_for: at.toISOString(),
        }))
    )
  );

  if (rows.length > 0) {
    const { error } = await supabase.from("sequence_steps").insert(rows);
    if (error) throw new Error(`Couldn't schedule follow-up messages: ${error.message}`);
  }
}
