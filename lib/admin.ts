import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Platform staff (the TreatmentTrack team), not practice staff. Set
 * PLATFORM_ADMIN_EMAILS to a comma-separated list of sign-in emails.
 * Unset means nobody — the back office is closed by default.
 */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"))
  );
}

export function isPlatformAdminEmail(email: string | null | undefined, allowlist: Set<string>): boolean {
  return !!email && allowlist.has(email.trim().toLowerCase());
}

/** The reporting windows the back office uses: ISO timestamps for 7 and 30 days ago. */
export function reportWindows(now = new Date()): { d7: string; d30: string } {
  return {
    d7: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
    d30: new Date(now.getTime() - 30 * 86_400_000).toISOString(),
  };
}

/**
 * Gate for /admin. Must be signed in AND on the allowlist; anyone else is
 * sent to the ordinary dashboard without learning the back office exists.
 * Pages behind this gate may use the service-role client to read across
 * practices — that is the point of the back office — but must never write
 * with it.
 */
export async function requirePlatformAdmin(): Promise<{ email: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowlist = parseAdminEmails(process.env.PLATFORM_ADMIN_EMAILS);
  if (!user || !isPlatformAdminEmail(user.email, allowlist)) {
    redirect("/dashboard");
  }
  return { email: user.email! };
}
