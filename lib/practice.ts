import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { needsSecondFactor } from "@/lib/mfa";
import type { Plan, BillingInterval } from "@/lib/types";

/** owner: everything. staff: all day-to-day work. dentist: only their own quotes. */
export type Role = "owner" | "staff" | "dentist";

export interface CurrentPractice {
  id: string;
  name: string;
  slug: string;
  plan: Plan | null;
  billing_interval: BillingInterval | null;
  status: string;
  /** Set when this is an extra location billed under another practice. */
  billing_practice_id: string | null;
  /** Dentist-first account: sends nothing until the practice owner approves. */
  requires_owner_approval: boolean;
  owner_approved_at: string | null;
  owner_approved_by_name: string | null;
}

const PRACTICE_COLUMNS =
  "id, name, slug, plan, billing_interval, status, billing_practice_id, requires_owner_approval, owner_approved_at, owner_approved_by_name";

/**
 * Resolves the signed-in user's current practice (the one they last switched
 * to, if they belong to several) and their role in it. This is the same
 * practice every row-level security policy uses, via current_practice_id().
 * Redirects to /login if there's no session or no practice membership yet.
 * Cached per request, so the layout and page share one lookup.
 */
export const requireCurrentPractice = cache(async (): Promise<{
  userId: string;
  practice: CurrentPractice;
  role: Role;
  /** Whether quotes can be assigned to this person (always true for dentists). */
  treatsPatients: boolean;
  displayName: string | null;
  /** Whether they've finished or skipped the first-login guided tour. */
  tourCompleted: boolean;
}> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Two-factor sign-in is on for this login but no code entered yet.
  if (await needsSecondFactor(supabase)) redirect("/login?step=verify");

  const { data: practiceId } = await supabase.rpc("current_practice_id");
  if (!practiceId) redirect("/login");

  const [{ data: practice }, { data: membership }] = await Promise.all([
    supabase.from("practices").select(PRACTICE_COLUMNS).eq("id", practiceId).maybeSingle(),
    supabase
      .from("practice_members")
      .select("role, display_name, treats_patients")
      .eq("practice_id", practiceId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!practice || !membership) redirect("/login");

  return {
    userId: user.id,
    practice: practice as CurrentPractice,
    role: membership.role as Role,
    treatsPatients: membership.role === "dentist" || membership.treats_patients,
    displayName: membership.display_name,
    tourCompleted: Boolean(user.user_metadata?.tour_completed_at),
  };
});

/** For owner-only pages and actions. Staff are sent back to the dashboard. */
export async function requireOwner() {
  const current = await requireCurrentPractice();
  if (current.role !== "owner") redirect("/dashboard");
  return current;
}

/** Every practice the signed-in user belongs to, for the switcher. */
export async function listMyPractices(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("practices").select("id, name").order("name");
  return data ?? [];
}

export interface TreatingDentist {
  userId: string;
  name: string;
}

/**
 * Everyone quotes can be assigned to in the current practice: Dentist
 * logins, plus owners/staff marked as seeing patients. Names come from the
 * Team page ("Dr Patel"); anyone without one is listed as "Unnamed dentist".
 */
export async function listTreatingDentists(practiceId: string): Promise<TreatingDentist[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("practice_members")
    .select("user_id, role, display_name, treats_patients")
    .eq("practice_id", practiceId);
  return (data ?? [])
    .filter((m) => m.role === "dentist" || m.treats_patients)
    .map((m) => ({ userId: m.user_id as string, name: (m.display_name as string | null)?.trim() || "Unnamed dentist" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
