"use server";

import { createClient } from "@/lib/supabase/server";

export interface RequestCallbackResult {
  error?: string;
  success?: boolean;
}

/**
 * Public lead form for groups running more than 5 practices — no account
 * exists yet, so this runs as an anonymous insert under the
 * callback_requests_public_insert RLS policy rather than anything
 * practice-scoped.
 */
export async function requestCallback(formData: FormData): Promise<RequestCallbackResult> {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const practiceCountRaw = String(formData.get("practiceCount") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  // Honeypot: a field real visitors never see or fill. Bots that stuff
  // every input give themselves away; we pretend it worked so they move on.
  if (String(formData.get("website") ?? "").trim() !== "") {
    return { success: true };
  }

  if (!name || !email) {
    return { error: "Please fill in your name and email." };
  }
  if (name.length > 200 || email.length > 320 || phone.length > 50 || message.length > 2000) {
    return { error: "One of the fields is too long. Please shorten it and try again." };
  }

  const practiceCount = practiceCountRaw ? Number(practiceCountRaw) : null;

  const { error } = await supabase.from("callback_requests").insert({
    name,
    email,
    phone: phone || null,
    practice_count: Number.isFinite(practiceCount) ? practiceCount : null,
    message: message || null,
  });

  if (error) {
    return { error: "Couldn't send your request. Please try again or email us directly." };
  }

  return { success: true };
}
