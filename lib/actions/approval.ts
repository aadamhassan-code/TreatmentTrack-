"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/practice";
import { emailProvider } from "@/lib/messaging/email";

export interface ApprovalRequestResult {
  error?: string;
  link?: string;
  emailed?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/**
 * A dentist-first account asks the practice owner to approve it. Makes a
 * one-time link (only its hash is stored) and emails it if email sending is
 * set up; the link is always shown too, so it can be sent another way.
 * Asking again replaces the previous link.
 */
export async function requestOwnerApproval(formData: FormData): Promise<ApprovalRequestResult> {
  const { practice, displayName } = await requireOwner();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(ownerEmail)) return { error: "Please enter the practice owner's email address." };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("practices")
    .select("requires_owner_approval, owner_approved_at")
    .eq("id", practice.id)
    .single();
  if (!row?.requires_owner_approval) return { error: "This account doesn't need approval." };
  if (row.owner_approved_at) return { error: "The practice owner has already approved this account." };

  const token = randomBytes(24).toString("base64url");
  const { error } = await admin
    .from("practices")
    .update({ approval_token_hash: hashToken(token), approval_requested_email: ownerEmail })
    .eq("id", practice.id);
  if (error) return { error: "Couldn't create the approval link. Please try again." };

  const link = `${siteUrl()}/approve/${token}`;
  let emailed = false;
  if (emailProvider.isConfigured()) {
    const who = displayName || "One of your dentists";
    const result = await emailProvider.send({
      to: ownerEmail,
      subject: `${who} would like to follow up their treatment quotes at ${practice.name}`,
      body:
        `${who} has set up TreatmentTrack to send polite follow-up messages to their patients who were quoted for treatment at ${practice.name} but haven't booked yet.\n\n` +
        `Messages go out in ${practice.name}'s name, so nothing will be sent until you approve it here:\n\n${link}\n\n` +
        `If you weren't expecting this, you can ignore this email and nothing will be sent.`,
    });
    emailed = result.ok;
  }

  revalidatePath("/approval");
  return { link, emailed };
}

export interface ApproveResult {
  error?: string;
  ok?: boolean;
}

/** The practice owner approves, from the public link. No login needed — the link is the key. */
export async function approvePractice(token: string, formData: FormData): Promise<ApproveResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const confirmed = formData.get("confirm") === "on";

  if (!name) return { error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter your email address." };
  if (!confirmed) return { error: "Please tick the box to confirm." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("practices")
    .update({
      owner_approved_at: new Date().toISOString(),
      owner_approved_by_name: name,
      owner_approved_by_email: email,
      approval_token_hash: null,
    })
    .eq("approval_token_hash", hashToken(token))
    .eq("requires_owner_approval", true)
    .is("owner_approved_at", null)
    .select("id");

  if (error) return { error: "Something went wrong. Please try again." };
  if (!data?.length) return { error: "This approval link has expired or was already used." };
  return { ok: true };
}
