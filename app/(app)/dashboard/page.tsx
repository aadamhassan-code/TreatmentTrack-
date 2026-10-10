import { LedgerStat } from "@/components/ui/ledger-stat";
import { TreatmentsTable } from "@/components/dashboard/treatments-table";
import { LinkButton } from "@/components/ui/button";
import { formatGBP, ukDate } from "@/lib/utils";
import { periodStart } from "@/lib/reports";
import { displayStatus } from "@/lib/treatment-status";
import { requireCurrentPractice } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { OPEN_STATUSES, type Treatment } from "@/lib/types";

export default async function DashboardPage() {
  const { practice } = await requireCurrentPractice();
  const supabase = await createClient();

  // The 1st of this month in UK time. The query starts a day earlier so no
  // UK-time booking is missed; the exact cut-off is applied below.
  const monthStart = periodStart("month")!;
  const queryFrom = new Date(`${monthStart}T00:00:00Z`);
  queryFrom.setUTCDate(queryFrom.getUTCDate() - 1);

  const [open, bookedRecently, { data: recentlyClosed }] = await Promise.all([
    // Open quotes, biggest first — the ones most worth a phone call today.
    fetchAll<Treatment>((from, to) =>
      supabase
        .from("treatments")
        .select("*, patient:patients(*), sequence_steps(status, error)")
        .eq("practice_id", practice.id)
        .in("status", OPEN_STATUSES)
        .order("value_pence", { ascending: false })
        .order("quoted_on", { ascending: true })
        .order("id")
        .range(from, to)
    ),
    fetchAll<{ value_pence: number; converted_at: string }>((from, to) =>
      supabase
        .from("treatments")
        .select("value_pence, converted_at")
        .eq("practice_id", practice.id)
        .eq("status", "converted")
        .gte("converted_at", queryFrom.toISOString())
        .order("id")
        .range(from, to)
    ),
    supabase
      .from("treatments")
      .select("*, patient:patients(*)")
      .eq("practice_id", practice.id)
      .in("status", ["converted", "declined", "lost"])
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  const bookedThisMonth = bookedRecently.filter((t) => ukDate(t.converted_at) >= monthStart);
  // Opted-out patients won't get any more messages, so their quotes stay
  // listed (they might still book) but aren't counted as pipeline.
  const optedOut = open.filter((t) => displayStatus(t) === "opted_out");
  const following = open.filter((t) => displayStatus(t) !== "opted_out");
  const pipelinePence = following.reduce((sum, t) => sum + t.value_pence, 0);
  const recoveredPence = bookedThisMonth.reduce((sum, t) => sum + t.value_pence, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink-900">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">{practice.name}</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/treatments/import" variant="secondary">
            Import CSV
          </LinkButton>
          <LinkButton href="/treatments/new">Add treatment</LinkButton>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <LedgerStat
          label="Pipeline value"
          value={formatGBP(pipelinePence)}
          caption={
            `${following.length} open quote${following.length === 1 ? "" : "s"} being followed up` +
            (optedOut.length ? ` · ${optedOut.length} opted out, not counted` : "")
          }
        />
        <LedgerStat
          label="Recovered this month"
          value={formatGBP(recoveredPence)}
          caption={`${bookedThisMonth.length} quote${bookedThisMonth.length === 1 ? "" : "s"} booked this month`}
          accent
        />
      </div>

      <div>
        <h2 className="font-display text-xl font-medium text-ink-900">Open quotes</h2>
        <p className="mb-3 mt-1 text-sm text-ink-500">
          Highest value first. When a patient books, declines or goes elsewhere,
          mark it here and their follow-up messages stop.
        </p>
        <TreatmentsTable treatments={open} mode="open" />
      </div>

      {(recentlyClosed?.length ?? 0) > 0 && (
        <div>
          <h2 className="mb-3 font-display text-xl font-medium text-ink-900">Recently closed</h2>
          <TreatmentsTable treatments={(recentlyClosed ?? []) as unknown as Treatment[]} mode="closed" />
        </div>
      )}
    </div>
  );
}
