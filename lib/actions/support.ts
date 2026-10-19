"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentPractice } from "@/lib/practice";
import { isMissingSchema } from "@/lib/supabase/compat";

export interface SupportResult {
  error?: string;
  success?: boolean;
}

/** In-app help request. Lands in the TreatmentTrack back office (/admin). */
export async function sendSupportRequest(formData: FormData): Promise<SupportResult> {
  const { practice, displayName } = await requireCurrentPractice();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const message = String(formData.get("message") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (message.length < 5) return { error: "Tell us a little about what you need help with." };
  if (message.length > 2000 || phone.length > 50) return { error: "That's a bit long. Please shorten it and try again." };

  const row = {
    name: displayName?.trim() || user?.email || "Practice user",
    email: user?.email ?? "unknown",
    phone: phone || null,
    message,
  };
  let { error } = await supabase.from("callback_requests").insert({ ...row, topic: "support", practice_name: practice.name });
  if (isMissingSchema(error)) {
    ({ error } = await supabase
      .from("callback_requests")
      .insert({ ...row, message: `[Support, ${practice.name}] ${message}` }));
  }
  if (error) {
    console.error("Support request failed", error);
    return { error: "Couldn't send that. Please try again in a moment." };
  }
  return { success: true };
}
