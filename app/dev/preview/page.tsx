import { notFound } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { LedgerStat } from "@/components/ui/ledger-stat";
import { TreatmentsTable } from "@/components/dashboard/treatments-table";
import { RevenueChart } from "@/components/reports/revenue-chart";
import { monthlyBooked, type PerfTreatment } from "@/lib/performance";
import type { Treatment } from "@/lib/types";

/**
 * Development-only visual check of the logged-in app's building blocks with
 * sample data (no database needed). Returns 404 in production builds.
 */
export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const patient = (id: string, name: string) => ({
    id, practice_id: "p", full_name: name, phone: "+447700900123", email: null, opted_out_at: null, created_at: "2026-10-01",
  });
  const tr = (id: string, name: string, type: string, pence: number, quoted: string, dentist: string | null, status: Treatment["status"] = "in_sequence"): Treatment => ({
    id, practice_id: "p", patient_id: id, treatment_type: type, value_pence: pence, status, quote_followup_consent_id: "c",
    future_intent_remind_at: status === "future_intent" ? "2027-01-02" : null, created_at: quoted, updated_at: quoted,
    converted_at: status === "converted" ? "2026-10-15" : null, declined_at: null, lost_at: null, quoted_on: quoted,
    source: "manual", external_id: null, dentist_user_id: dentist, patient: patient(id, name),
    sequence_steps: [{ status: "pending", error: null, scheduled_for: "2026-10-22T08:00:00Z" }],
  });
  const open = [
    tr("1", "Olivia Reed", "Porcelain crowns x2", 280_000, "2026-10-06", "d1"),
    tr("2", "Thomas Baker-Llewellyn", "Dental implant, upper left with bone graft", 260_000, "2026-09-15", null),
    tr("3", "Priya Shah", "Veneers", 250_000, "2026-10-11", "d2", "future_intent"),
    tr("4", "Grace Lee", "Invisalign", 320_000, "2026-10-10", "d1"),
  ];
  const names = { d1: "Dr Patel", d2: "Dr Owner" };
  const history: PerfTreatment[] = Array.from({ length: 30 }, (_, i) => ({
    treatment_type: "Implant", value_pence: 120_000 + (i % 7) * 40_000, status: "converted",
    quoted_on: "2026-01-01", converted_at: new Date(Date.UTC(2025, 11 + Math.floor(i / 3), 5 + i)).toISOString(), dentist_user_id: "d1",
  }));

  return (
    <div className="min-h-full md:flex">
      <Sidebar practiceId="p" practiceName="Test Dental Practice" practices={[{ id: "p", name: "Test Dental Practice" }]} role="owner" dentallyPending={3} />
      <div className="min-w-0 flex-1 bg-cream-50">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
          <h1 className="font-display text-3xl text-ink-900">Dashboard</h1>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <LedgerStat label="Open pipeline" value="£11,350" caption="8 quotes being followed up, 2 opted out (not counted)" />
            <LedgerStat label="Booked this month" value="£11,100" caption="3 quotes booked" accent />
            <LedgerStat label="Booking rate" value="18%" caption="of 17 quotes made in the last 90 days" />
            <LedgerStat label="Messages this week" value="6" caption="due to go out in the next 7 days" />
          </div>
          <TreatmentsTable treatments={open} mode="open" dentistNames={names} />
          <RevenueChart points={monthlyBooked(history, "2026-10-19")} title="Revenue booked, last 12 months" />
        </div>
      </div>
    </div>
  );
}
