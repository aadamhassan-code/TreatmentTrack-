import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarginBoard, MarginInputs } from "@/lib/margins";

/**
 * Loads the owner's margin inputs: lab & materials % per case board and
 * each dentist's share. Owners only — returns null for anyone else, so
 * margins simply don't show (row-level security would hide the shares
 * anyway).
 */
export async function loadMarginInputs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  practiceId: string,
  role: string
): Promise<(MarginInputs & { configured: boolean }) | null> {
  if (role !== "owner") return null;
  const [{ data: boards, error: boardError }, { data: rates }] = await Promise.all([
    supabase
      .from("case_boards")
      .select("id, name, keywords, is_default, position, lab_cost_pct")
      .eq("practice_id", practiceId),
    supabase.from("dentist_pay_rates").select("user_id, share_pct").eq("practice_id", practiceId),
  ]);
  if (boardError) return null; // e.g. migration 0009 not run yet
  const marginBoards = ((boards ?? []) as MarginBoard[]).map((b) => ({
    ...b,
    lab_cost_pct: b.lab_cost_pct == null ? null : Number(b.lab_cost_pct),
  }));
  const shareByDentist = new Map((rates ?? []).map((r) => [r.user_id as string, Number(r.share_pct)]));
  return {
    boards: marginBoards,
    shareByDentist,
    configured: shareByDentist.size > 0 || marginBoards.some((b) => b.lab_cost_pct != null),
  };
}
