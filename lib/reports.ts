import type { TreatmentStatus } from "@/lib/types";
import { ukDate } from "@/lib/utils";

export type ReportPeriod = "month" | "90d" | "12m" | "all";

export const REPORT_PERIODS: { value: ReportPeriod; label: string; phrase: string }[] = [
  { value: "month", label: "This month", phrase: "this month" },
  { value: "90d", label: "Last 90 days", phrase: "in the last 90 days" },
  { value: "12m", label: "Last 12 months", phrase: "in the last 12 months" },
  { value: "all", label: "All time", phrase: "since you started" },
];

export function parsePeriod(raw: unknown): ReportPeriod {
  return REPORT_PERIODS.some((p) => p.value === raw) ? (raw as ReportPeriod) : "month";
}

/** First day of the period as a UK "YYYY-MM-DD" date, or null for all time. */
export function periodStart(period: ReportPeriod, today: string = ukDate()): string | null {
  if (period === "all") return null;
  if (period === "month") return `${today.slice(0, 8)}01`;
  const d = new Date(`${today}T00:00:00Z`);
  if (period === "90d") d.setUTCDate(d.getUTCDate() - 89);
  else d.setUTCFullYear(d.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface ReportTreatment {
  treatment_type: string;
  value_pence: number;
  status: TreatmentStatus;
  quoted_on: string;
  converted_at: string | null;
}

export interface Tally {
  count: number;
  valuePence: number;
}

export interface TreatmentTypeRow {
  treatmentType: string;
  quoted: Tally;
  booked: Tally;
  /** Booked ÷ quoted, 0–1, or null if nothing was quoted. */
  bookingRate: number | null;
}

export interface Report {
  quoted: Tally;
  booked: Tally;
  declined: Tally;
  lost: Tally;
  open: Tally;
  bookingRate: number | null;
  /** Booked during the period, whenever the quote was made — matches "Recovered this month". */
  recovered: Tally;
  byTreatment: TreatmentTypeRow[];
}

const empty = (): Tally => ({ count: 0, valuePence: 0 });
const add = (t: Tally, pence: number) => {
  t.count++;
  t.valuePence += pence;
};

/**
 * Outcomes for the quotes made in the period (grouped by the date the
 * patient was quoted), plus the revenue actually booked in the period.
 */
export function buildReport(treatments: ReportTreatment[], from: string | null): Report {
  const report: Report = {
    quoted: empty(),
    booked: empty(),
    declined: empty(),
    lost: empty(),
    open: empty(),
    bookingRate: null,
    recovered: empty(),
    byTreatment: [],
  };
  const byType = new Map<string, TreatmentTypeRow>();

  for (const t of treatments) {
    if (t.status === "converted" && t.converted_at && (!from || ukDate(t.converted_at) >= from)) {
      add(report.recovered, t.value_pence);
    }

    if (from && t.quoted_on < from) continue;

    add(report.quoted, t.value_pence);
    if (t.status === "converted") add(report.booked, t.value_pence);
    else if (t.status === "declined") add(report.declined, t.value_pence);
    else if (t.status === "lost") add(report.lost, t.value_pence);
    else add(report.open, t.value_pence);

    let row = byType.get(t.treatment_type);
    if (!row) {
      row = { treatmentType: t.treatment_type, quoted: empty(), booked: empty(), bookingRate: null };
      byType.set(t.treatment_type, row);
    }
    add(row.quoted, t.value_pence);
    if (t.status === "converted") add(row.booked, t.value_pence);
  }

  const rate = (booked: Tally, quoted: Tally) => (quoted.count ? booked.count / quoted.count : null);
  report.bookingRate = rate(report.booked, report.quoted);
  report.byTreatment = Array.from(byType.values())
    .map((r) => ({ ...r, bookingRate: rate(r.booked, r.quoted) }))
    .sort((a, b) => b.quoted.valuePence - a.quoted.valuePence);

  return report;
}
