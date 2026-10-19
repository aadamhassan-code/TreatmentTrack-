"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/practice";

function parsePct(raw: string): number | null | "invalid" {
  const v = raw.trim().replace(/%$/, "");
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return "invalid";
  return Math.round(n * 100) / 100;
}

/** Owner sets (or clears) a treating dentist's share of fees, for margin estimates. */
export async function setDentistShare(dentistUserId: string, raw: string): Promise<{ error?: string; message?: string }> {
  const { practice } = await requireOwner();
  const pct = parsePct(raw);
  if (pct === "invalid") return { error: "Enter a percentage from 0 to 100, or leave it blank." };
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("practice_members")
    .select("user_id")
    .eq("practice_id", practice.id)
    .eq("user_id", dentistUserId)
    .maybeSingle();
  if (!member) return { error: "That person isn't on this practice's team." };

  const { error } =
    pct === null
      ? await supabase.from("dentist_pay_rates").delete().eq("practice_id", practice.id).eq("user_id", dentistUserId)
      : await supabase
          .from("dentist_pay_rates")
          .upsert(
            { practice_id: practice.id, user_id: dentistUserId, share_pct: pct, updated_at: new Date().toISOString() },
            { onConflict: "practice_id,user_id" }
          );
  if (error) return { error: "Couldn't save that. Please try again." };
  revalidatePath("/team");
  revalidatePath("/dentists");
  revalidatePath("/reports");
  return { message: "Saved." };
}

/** Owner sets (or clears) the typical lab & materials cost for a kind of treatment. */
export async function setBoardLabCost(boardId: string, raw: string): Promise<{ error?: string; message?: string }> {
  const { practice } = await requireOwner();
  const pct = parsePct(raw);
  if (pct === "invalid") return { error: "Enter a percentage from 0 to 100, or leave it blank." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("case_boards")
    .update({ lab_cost_pct: pct })
    .eq("id", boardId)
    .eq("practice_id", practice.id);
  if (error) return { error: "Couldn't save that. Please try again." };
  revalidatePath("/settings");
  revalidatePath("/dentists");
  revalidatePath("/reports");
  return { message: "Saved." };
}
