import type { TreatmentStatus } from "@/lib/types";
import { ukDate } from "@/lib/utils";
import { addMargin, emptyMargin, estimateMargin, type MarginBreakdown, type MarginInputs } from "@/lib/margins";

export interface PerfTreatment {
  treatment_type: string;
  value_pence: number;
  status: TreatmentStatus;
  quoted_on: string;
  converted_at: string | null;
  dentist_user_id: string | null;
}

export interface Tally {
  count: number;
  valuePence: number;
}

export interface DentistPerformance {
  /** null = quotes not assigned to a dentist. */
  dentistUserId: string | null;
  /** Quotes made in the period. */
  quoted: Tally;
  /** Of the quotes made in the period, those booked so far. */
  booked: Tally;
  bookingRate: number | null;
  /** Booked during the period, whenever quoted: the revenue follow-up brought in. */
  recovered: Tally;
  /** Average days from quote to booking, for bookings in the period. */
  avgDaysToBook: number | null;
  /** Everything still open today, whatever its date. */
  open: Tally;
  /** Estimated margin on `recovered`, when margin inputs are given. */
  margin: MarginBreakdown | null;
}

const empty = (): Tally => ({ count: 0, valuePence: 0 });
const add = (t: Tally, pence: number) => {
  t.count++;
  t.valuePence += pence;
};

const OPEN = new Set<TreatmentStatus>(["in_sequence", "future_intent"]);

function daysBetween(fromDate: string, toDate: string): number {
  return Math.max(0, Math.round((Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000));
}

/** Per-dentist performance for a period starting `from` (UK date), or all time. */
export function buildDentistPerformance(
  treatments: PerfTreatment[],
  from: string | null,
  margins?: MarginInputs
): DentistPerformance[] {
  const rows = new Map<string | null, DentistPerformance & { _days: number[] }>();
  const row = (id: string | null) => {
    let r = rows.get(id);
    if (!r) {
      r = {
        dentistUserId: id,
        quoted: empty(),
        booked: empty(),
        bookingRate: null,
        recovered: empty(),
        avgDaysToBook: null,
        open: empty(),
        margin: margins ? emptyMargin() : null,
        _days: [],
      };
      rows.set(id, r);
    }
    return r;
  };

  for (const t of treatments) {
    const r = row(t.dentist_user_id ?? null);
    if (OPEN.has(t.status)) add(r.open, t.value_pence);

    if (t.status === "converted" && t.converted_at) {
      const bookedOn = ukDate(t.converted_at);
      if (!from || bookedOn >= from) {
        add(r.recovered, t.value_pence);
        r._days.push(daysBetween(t.quoted_on, bookedOn));
        if (margins && r.margin) r.margin = addMargin(r.margin, estimateMargin(t, margins));
      }
    }

    if (from && t.quoted_on < from) continue;
    add(r.quoted, t.value_pence);
    if (t.status === "converted") add(r.booked, t.value_pence);
  }

  return Array.from(rows.values())
    .map(({ _days, ...r }) => ({
      ...r,
      bookingRate: r.quoted.count ? r.booked.count / r.quoted.count : null,
      avgDaysToBook: _days.length ? Math.round(_days.reduce((a, b) => a + b, 0) / _days.length) : null,
    }))
    .sort((a, b) => b.recovered.valuePence - a.recovered.valuePence || b.quoted.valuePence - a.quoted.valuePence);
}

export interface MonthPoint {
  /** "YYYY-MM" */
  month: string;
  /** "Oct" */
  label: string;
  bookedPence: number;
  bookedCount: number;
}

/** Revenue booked per calendar month (UK time), oldest first, ending this month. */
export function monthlyBooked(treatments: PerfTreatment[], today: string = ukDate(), months = 12): MonthPoint[] {
  const [y, m] = today.split("-").map(Number);
  const points: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    points.push({
      month: key,
      label: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(d),
      bookedPence: 0,
      bookedCount: 0,
    });
  }
  const index = new Map(points.map((p, i) => [p.month, i]));
  for (const t of treatments) {
    if (t.status !== "converted" || !t.converted_at) continue;
    const i = index.get(ukDate(t.converted_at).slice(0, 7));
    if (i === undefined) continue;
    points[i].bookedPence += t.value_pence;
    points[i].bookedCount += 1;
  }
  return points;
}
