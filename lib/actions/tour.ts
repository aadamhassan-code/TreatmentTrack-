"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Remembers that this person has finished or skipped the guided tour, so it
 * doesn't start again on any device. Stored on their login (Supabase user
 * metadata) rather than in a table — it's a preference, not practice data.
 */
export async function markTourComplete() {
  const supabase = await createClient();
  await supabase.auth.updateUser({ data: { tour_completed_at: new Date().toISOString() } });
}
