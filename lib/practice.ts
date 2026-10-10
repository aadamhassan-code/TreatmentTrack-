import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Plan, BillingInterval } from "@/lib/types";

export type Role = "owner" | "staff";

export interface CurrentPractice {
  id: string;
  name: string;
  slug: string;
  plan: Plan | null;
  billing_interval: BillingInterval | null;
  status: string;
  /** Set when this is an extra location billed under another practice. */
  billing_practice_id: string | null;
}

const PRACTICE_COLUMNS = "id, name, slug, plan, billing_interval, status, billing_practice_id";

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
}> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: practiceId } = await supabase.rpc("current_practice_id");
  if (!practiceId) redirect("/login");

  const [{ data: practice }, { data: membership }] = await Promise.all([
    supabase.from("practices").select(PRACTICE_COLUMNS).eq("id", practiceId).maybeSingle(),
    supabase
      .from("practice_members")
      .select("role")
      .eq("practice_id", practiceId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!practice || !membership) redirect("/login");

  return { userId: user.id, practice: practice as CurrentPractice, role: membership.role as Role };
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
