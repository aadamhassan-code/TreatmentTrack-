"use server";

import { createClient } from "@/lib/supabase/server";
import { isMissingSchema } from "@/lib/supabase/compat";

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
  const practiceName = String(formData.get("practiceName") ?? "").trim();
  const software = String(formData.get("software") ?? "").trim().slice(0, 60);
  const plan = String(formData.get("plan") ?? "").trim().slice(0, 30);
  const rawTopic = String(formData.get("topic") ?? "");

  // Honeypot: a field real visitors never see or fill. Bots that stuff
  // every input give themselves away; we pretend it worked so they move on.
  if (String(formData.get("website") ?? "").trim() !== "") {
    return { success: true };
  }

  if (!name || !email) {
    return { error: "Please fill in your name and email." };
  }
  if (rawTopic === "founding" && !practiceName) {
    return { error: "Please add your practice name." };
  }
  if (practiceName.length > 200) {
    return { error: "The practice name is too long. Please shorten it." };
  }
  if (name.length > 200 || email.length > 320 || phone.length > 50 || message.length > 2000) {
    return { error: "One of the fields is too long. Please shorten it and try again." };
  }

  const practiceCount = practiceCountRaw ? Number(practiceCountRaw) : null;

  const row = {
    name,
    email,
    phone: phone || null,
    practice_count: Number.isFinite(practiceCount) ? practiceCount : null,
    message:
      rawTopic === "founding"
        ? [
            "Founding practice request.",
            software && `Practice software: ${software}.`,
            plan && `Interested in the ${plan} plan.`,
            message,
          ]
            .filter(Boolean)
            .join(" ")
        : message || null,
  };
  // Founding-practice requests are sales leads; the back office shows them
  // with "Founding practice request." at the start of the message.
  const topic = rawTopic === "walkthrough" ? "walkthrough" : "sales";
  let { error } = await supabase
    .from("callback_requests")
    .insert({ ...row, topic, ...(practiceName ? { practice_name: practiceName } : {}) });
  // Before migration 0009 there's no topic column: save without it.
  if (isMissingSchema(error)) ({ error } = await supabase.from("callback_requests").insert(row));

  if (error) {
    return { error: "Couldn't send your request. Please try again or email us directly." };
  }

  return { success: true };
}
