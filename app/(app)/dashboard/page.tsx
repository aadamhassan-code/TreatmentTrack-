import { LedgerStat } from "@/components/ui/ledger-stat";
import { TreatmentsTable } from "@/components/dashboard/treatments-table";
import { LinkButton } from "@/components/ui/button";
import { formatGBP } from "@/lib/utils";
import { requireCurrentPractice } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import type { Treatment } from "@/lib/types";

export default async function DashboardPage() {
  const { practice } = await requireCurrentPractice();
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: treatments } = await supabase
    .from("treatments")
    .select("*, patient:patients(*), sequence_steps(status, error)")
    .eq("practice_id", practice.id)
    .order("created_at", { ascending: false });

  const rows = (treatments ?? []) as unknown as Treatment[];

  const pipelinePence = rows
    .filter((t) => t.status === "in_sequence" || t.status === "future_intent")
    .reduce((sum, t) => sum + t.value_pence, 0);

  const recoveredPence = rows
    .filter(
      (t) =>
        t.status === "converted" &&
        t.converted_at &&
        new Date(t.converted_at) >= startOfMonth
    )
    .reduce((sum, t) => sum + t.value_pence, 0);

  const activeCount = rows.filter(
    (t) => t.status === "in_sequence" || t.status === "future_intent"
  ).length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink-900">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">{practice.name}</p>
        </div>
        <LinkButton href="/treatments/new">Add treatment</LinkButton>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <LedgerStat
          label="Pipeline value"
          value={formatGBP(pipelinePence)}
          caption={`${activeCount} quote${activeCount === 1 ? "" : "s"} still open`}
        />
        <LedgerStat
          label="Recovered this month"
          value={formatGBP(recoveredPence)}
          caption="Sum of treatments marked booked this month"
          accent
        />
      </div>

      <div>
        <h2 className="mb-3 font-display text-xl font-medium text-ink-900">
          Treatments
        </h2>
        <TreatmentsTable treatments={rows} />
      </div>
    </div>
  );
}
