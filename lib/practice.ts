import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Plan, BillingInterval } from "@/lib/types";

export interface CurrentPractice {
  id: string;
  name: string;
  slug: string;
  plan: Plan | null;
  billing_interval: BillingInterval | null;
  status: string;
}

/**
 * Resolves the signed-in user's practice for use in Server Components.
 * Redirects to /login if there's no session or no practice membership yet
 * (the latter can only happen for an account that never completed billing).
 */
export async function requireCurrentPractice(): Promise<{
  userId: string;
  practice: CurrentPractice;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("practice_members")
    .select("practice_id, practices(id, name, slug, plan, billing_interval, status)")
    .eq("user_id", user.id)
    .maybeSingle();

  const joined = membership?.practices as unknown;
  const practice = (Array.isArray(joined) ? joined[0] : joined) as
    | CurrentPractice
    | undefined;

  if (!practice) redirect("/login");

  return { userId: user.id, practice };
}
