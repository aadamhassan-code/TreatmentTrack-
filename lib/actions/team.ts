"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, findAuthUserIdByEmail } from "@/lib/supabase/admin";
import { requireCurrentPractice, requireOwner, type Role } from "@/lib/practice";
import { slugifyPracticeName } from "@/lib/stripe";

export interface TeamActionResult {
  error?: string;
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: readonly Role[] = ["owner", "staff", "dentist"];

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/**
 * Adds someone to the current practice. New people get an invite email to
 * set a password; people who already have a TreatmentTrack login (e.g. they
 * work at another of your locations) are simply added and see this practice
 * in their switcher next time they sign in.
 */
export async function inviteTeamMember(formData: FormData): Promise<TeamActionResult> {
  const { practice } = await requireOwner();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "staff") as Role;
  const displayName = String(formData.get("displayName") ?? "").trim() || null;

  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (!ROLES.includes(role)) return { error: "Please choose a role." };
  if (role === "dentist" && !displayName) {
    return { error: "Please enter how this dentist should be named, e.g. Dr Patel." };
  }

  const admin = createAdminClient();
  let userId = await findAuthUserIdByEmail(admin, email);
  let invited = false;

  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl()}/login`,
    });
    if (error || !data.user) {
      console.error("Team invite failed", error);
      const reason = error?.message.toLowerCase() ?? "";
      if (reason.includes("rate limit")) {
        return {
          error:
            "Too many invite emails have been sent in the last hour. Please try again later — or set up your own email sender in Supabase (Authentication → Emails → SMTP settings) to lift the limit.",
        };
      }
      if (reason.includes("invalid")) return { error: `${email} isn't an email address we can send to. Please check it.` };
      return { error: "Couldn't send the invite email. Please check the address and try again." };
    }
    userId = data.user.id;
    invited = true;
  }

  const { error } = await admin
    .from("practice_members")
    .insert({ practice_id: practice.id, user_id: userId, role, display_name: displayName, treats_patients: role === "dentist" });

  if (error) {
    if (error.code === "23505") return { error: `${email} is already on this practice's team.` };
    console.error("Failed to add team member", error);
    return { error: "Couldn't add them to the team. Please try again." };
  }

  revalidatePath("/team");
  return {
    message: invited
      ? `Invite sent to ${email}. They'll get an email with a link to set their password.`
      : `${email} already has a TreatmentTrack login, so they've been added — they'll see ${practice.name} next time they sign in.`,
  };
}

async function loadMember(memberId: string, practiceId: string) {
  const admin = createAdminClient();
  const [{ data: member }, { count: owners }] = await Promise.all([
    admin.from("practice_members").select("id, user_id, role").eq("id", memberId).eq("practice_id", practiceId).maybeSingle(),
    admin
      .from("practice_members")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practiceId)
      .eq("role", "owner"),
  ]);
  return { admin, member, owners: owners ?? 0 };
}

export async function changeMemberRole(memberId: string, role: Role): Promise<TeamActionResult> {
  const { practice, userId } = await requireOwner();
  if (!ROLES.includes(role)) return { error: "Unknown role." };

  const { admin, member, owners } = await loadMember(memberId, practice.id);
  if (!member) return { error: "That person isn't on this practice's team." };
  if (member.user_id === userId) return { error: "You can't change your own role. Ask another owner to do it." };
  if (member.role === "owner" && role !== "owner" && owners <= 1) {
    return { error: "A practice needs at least one owner." };
  }

  const { error } = await admin.from("practice_members").update({ role }).eq("id", member.id);
  if (error) return { error: "Couldn't change their role. Please try again." };

  revalidatePath("/team");
  return {};
}

export async function removeMember(memberId: string): Promise<TeamActionResult> {
  const { practice, userId } = await requireOwner();

  const { admin, member, owners } = await loadMember(memberId, practice.id);
  if (!member) return { error: "That person isn't on this practice's team." };
  if (member.user_id === userId) return { error: "You can't remove yourself. Ask another owner to do it." };
  if (member.role === "owner" && owners <= 1) return { error: "A practice needs at least one owner." };

  // Their login stays (they may work at another location); they just lose
  // access to this practice. Patient records they created are unaffected.
  const { error } = await admin.from("practice_members").delete().eq("id", member.id);
  if (error) return { error: "Couldn't remove them. Please try again." };

  revalidatePath("/team");
  return {};
}

/** Switches which of your practices you're working in. */
export async function switchPractice(practiceId: string) {
  const { userId } = await requireCurrentPractice();
  const supabase = await createClient();

  // Row-level security refuses this unless the user is a member of practiceId.
  const { error } = await supabase
    .from("user_active_practice")
    .upsert({ user_id: userId, practice_id: practiceId, updated_at: new Date().toISOString() });
  if (error) throw new Error("You don't have access to that practice.");

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Adds another practice location under this subscription (Multisite: up to
 * 5 in total; Enterprise: no limit). The database enforces the limit and
 * keeps every location's billing status in step with the paying practice.
 */
export async function addLocation(formData: FormData): Promise<TeamActionResult> {
  const { practice, userId } = await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Please enter a name for the new location." };

  const admin = createAdminClient();
  const rootId = practice.billing_practice_id ?? practice.id;

  // Only an owner of the practice that pays can add locations to it.
  const { data: rootMembership } = await admin
    .from("practice_members")
    .select("role")
    .eq("practice_id", rootId)
    .eq("user_id", userId)
    .maybeSingle();
  if (rootMembership?.role !== "owner") {
    return { error: "Only an owner of the practice that holds the subscription can add locations." };
  }

  const { data: root } = await admin
    .from("practices")
    .select("plan, billing_interval, status")
    .eq("id", rootId)
    .single();
  if (!root) return { error: "Couldn't find your subscription. Please try again." };

  const { data: location, error } = await admin
    .from("practices")
    .insert({
      name,
      slug: slugifyPracticeName(name),
      plan: root.plan,
      billing_interval: root.billing_interval,
      status: root.status,
      billing_practice_id: rootId,
    })
    .select("id")
    .single();

  if (error || !location) {
    if (error?.message.includes("allows")) {
      return {
        error:
          root.plan === "multisite"
            ? "You've reached the 5 locations included in Multisite. Request a callback from the pricing page to discuss more."
            : "Your plan covers one location. Upgrade to Multisite to run up to 5 locations from one account.",
      };
    }
    console.error("Failed to add location", error);
    return { error: "Couldn't add the location. Please try again." };
  }

  const { error: memberError } = await admin
    .from("practice_members")
    .insert({ practice_id: location.id, user_id: userId, role: "owner" });
  if (memberError) {
    console.error("Failed to add owner to new location", memberError);
    return { error: "The location was created but you couldn't be added to it. Please contact support." };
  }

  revalidatePath("/", "layout");
  return { message: `${name} has been added. Use the practice switcher to start working in it.` };
}

/**
 * Owner edits how a team member appears ("Dr Patel"), whether quotes can be
 * assigned to them, and (optionally) which Dentally practitioner they are
 * when their emails don't match.
 */
export async function updateMemberDetails(
  memberId: string,
  details: { displayName: string; treatsPatients: boolean; dentallyPractitionerId: string | null }
): Promise<TeamActionResult> {
  const { practice } = await requireOwner();
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("practice_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("practice_id", practice.id)
    .maybeSingle();
  if (!member) return { error: "That person isn't on this practice's team." };

  const displayName = details.displayName.trim() || null;
  if (member.role === "dentist" && !displayName) return { error: "Dentists need a name, e.g. Dr Patel." };

  const { error } = await admin
    .from("practice_members")
    .update({
      display_name: displayName,
      treats_patients: member.role === "dentist" ? true : details.treatsPatients,
      dentally_practitioner_id: details.dentallyPractitionerId || null,
    })
    .eq("id", member.id);
  if (error) return { error: "Couldn't save those details. Please try again." };

  revalidatePath("/team");
  return { message: "Saved." };
}
