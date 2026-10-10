import { Sidebar } from "@/components/layout/sidebar";
import { listMyPractices, requireCurrentPractice } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [{ practice, role }, practices] = await Promise.all([requireCurrentPractice(), listMyPractices()]);

  // Only show "From Dentally" once it's connected, with a count of plans
  // waiting for review.
  const [{ data: dentally }, { count: dentallyPending }] = await Promise.all([
    supabase.from("integrations").select("id").eq("practice_id", practice.id).eq("provider", "dentally").maybeSingle(),
    supabase
      .from("pms_quote_candidates")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practice.id)
      .eq("status", "pending")
      .is("blocked_reason", null),
  ]);

  return (
    <div className="min-h-full md:flex">
      <Sidebar
        practiceId={practice.id}
        practiceName={practice.name}
        practices={practices}
        role={role}
        dentallyPending={dentally ? (dentallyPending ?? 0) : null}
      />
      <div className="min-w-0 flex-1 bg-cream-50">
        {practice.requires_owner_approval && !practice.owner_approved_at && (
          <div className="border-b border-gold-500/30 bg-gold-100 px-4 py-3 text-sm text-ink-900 sm:px-8">
            <strong>Follow-up messages are on hold</strong> until the owner of {practice.name} approves this
            account, because they go out in the practice&rsquo;s name.{" "}
            {role === "owner" ? (
              <Link href="/approval" className="font-medium text-teal-800 underline">
                Ask for approval
              </Link>
            ) : (
              "The account holder can ask for approval."
            )}
          </div>
        )}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">{children}</div>
      </div>
    </div>
  );
}
