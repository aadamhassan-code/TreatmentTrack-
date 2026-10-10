import { Sidebar } from "@/components/layout/sidebar";
import { listMyPractices, requireCurrentPractice } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";

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
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">{children}</div>
      </div>
    </div>
  );
}
