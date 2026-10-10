import Link from "next/link";
import { requireCurrentPractice } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { DentallyReview, type Candidate } from "@/components/dentally/dentally-review";

export default async function DentallyReviewPage() {
  const { practice, role } = await requireCurrentPractice();
  const supabase = await createClient();

  const [{ data: integration }, { data: candidates }] = await Promise.all([
    supabase
      .from("integrations")
      .select("last_synced_at, last_sync_error")
      .eq("practice_id", practice.id)
      .eq("provider", "dentally")
      .maybeSingle(),
    supabase
      .from("pms_quote_candidates")
      .select("id, patient_name, phone, treatment_type, value_pence, quoted_on, blocked_reason")
      .eq("practice_id", practice.id)
      .eq("status", "pending")
      .order("value_pence", { ascending: false })
      .limit(500),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink-900">From Dentally</h1>
        <p className="mt-2 text-sm text-ink-500">
          Unbooked private treatment plans found in Dentally, highest value first. Nothing is sent until you start
          follow-up here — first confirm each patient was offered an opt-out for follow-up on their plan.
        </p>
      </div>

      {!integration ? (
        <p className="rounded-xl border border-dashed border-ink-900/15 px-6 py-10 text-center text-sm text-ink-500">
          Dentally isn&rsquo;t connected.{" "}
          {role === "owner" ? (
            <Link href="/settings" className="font-medium text-teal-700 underline">
              Connect it in Settings
            </Link>
          ) : (
            "Ask a practice owner to connect it in Settings."
          )}
        </p>
      ) : (
        <DentallyReview
          candidates={(candidates ?? []) as Candidate[]}
          lastSyncedAt={integration.last_synced_at}
          lastSyncError={integration.last_sync_error}
        />
      )}
    </div>
  );
}
