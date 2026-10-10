"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/practice";
import type { Channel, SequenceStep } from "@/lib/types";

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

  const rows = entries
    .filter((e) => e.body.trim().length > 0)
    .map((e) => ({
      practice_id: practice.id,
      step: e.step,
      channel: e.channel,
      body: e.body,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return;

  await supabase.from("message_templates").upsert(rows, { onConflict: "practice_id,step,channel" });
  revalidatePath("/settings");
}
