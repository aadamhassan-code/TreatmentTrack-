import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when this login has two-factor sign-in turned on but the current
 * session hasn't entered a code yet (signed in with the password only).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function needsSecondFactor(supabase: SupabaseClient<any, any, any>): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === "aal2" && data.currentLevel !== "aal2";
}
