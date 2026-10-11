"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/practice";
import type { Channel, SequenceStep } from "@/lib/types";
import { scheduleProblem } from "@/lib/schedule";

export async function updateChannelSettings(formData: FormData) {
  const { practice } = await requireOwner();
  const supabase = await createClient();

  await supabase
    .from("settings")
    .update({
      sms_enabled: formData.get("sms_enabled") === "on",
      whatsapp_enabled: formData.get("whatsapp_enabled") === "on",
      email_enabled: formData.get("email_enabled") === "on",
      cross_sell_enabled: formData.get("cross_sell_enabled") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("practice_id", practice.id);

  revalidatePath("/settings");
}

export interface TemplateEntry {
  step: SequenceStep;
  channel: Channel;
  body: string;
}

export async function saveTemplates(entries: TemplateEntry[]) {
  const { practice } = await requireOwner();
  const supabase = await createClient();

  const now = new Date().toISOString();
  const rows = entries
    .filter((e) => e.body.trim().length > 0)
    .map((e) => ({ practice_id: practice.id, step: e.step, channel: e.channel, body: e.body, updated_at: now }));

  // Clearing a template's text removes it, so that step isn't sent on that
  // channel. Messages already scheduled for it fail at send time with
  // "No template configured" rather than sending something blank.
  const cleared = entries.filter((e) => e.body.trim().length === 0);

  if (rows.length > 0) {
    const { error } = await supabase.from("message_templates").upsert(rows, { onConflict: "practice_id,step,channel" });
    if (error) throw new Error("Couldn't save templates");
  }
  for (const e of cleared) {
    await supabase
      .from("message_templates")
      .delete()
      .eq("practice_id", practice.id)
      .eq("step", e.step)
      .eq("channel", e.channel);
  }
  revalidatePath("/settings");
}

/**
 * Owner sets how many follow-up messages go and when (days after the
 * quote). Applies to quotes added from now on; quotes already part-way
 * through keep the messages they were given.
 */
export async function updateSequenceDays(days: number[]): Promise<{ error?: string }> {
  const { practice } = await requireOwner();
  const problem = scheduleProblem(days);
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ sequence_days: days, updated_at: new Date().toISOString() })
    .eq("practice_id", practice.id);
  if (error) return { error: "Couldn't save the schedule. Please try again." };

  revalidatePath("/settings");
  return {};
}
