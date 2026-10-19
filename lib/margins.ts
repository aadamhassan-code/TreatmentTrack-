import { pickBoard } from "@/lib/cases";

/**
 * Estimated practice margin on booked treatment, for owners.
 *
 *   lab cost        = fee × the treatment category's lab & materials %
 *   dentist's share = (fee − lab cost) × the dentist's share %
 *   practice margin = fee − lab cost − dentist's share
 *
 * i.e. lab bills shared in the same proportion as fees, the usual UK
 * associate arrangement. Missing inputs count as 0%, and are reported so
 * the page can say the figure is incomplete.
 */
export interface MarginBoard {
  id: string;
  name: string;
  keywords: string[];
  is_default: boolean;
  position: number;
  lab_cost_pct: number | null;
}

export interface MarginInputs {
  boards: MarginBoard[];
  /** Dentist user id → share of fees, 0–100. */
  shareByDentist: Map<string, number>;
}

export interface MarginBreakdown {
  feePence: number;
  labPence: number;
  dentistPence: number;
  marginPence: number;
  /** True when a lab % or a dentist share needed for this figure isn't set. */
  incomplete: boolean;
}

export const emptyMargin = (): MarginBreakdown => ({
  feePence: 0,
  labPence: 0,
  dentistPence: 0,
  marginPence: 0,
  incomplete: false,
});

export function estimateMargin(
  t: { value_pence: number; treatment_type: string; dentist_user_id?: string | null },
  inputs: MarginInputs
): MarginBreakdown {
  const board = pickBoard(inputs.boards, t.treatment_type);
  const labPct = board?.lab_cost_pct ?? null;
  const sharePct = t.dentist_user_id ? (inputs.shareByDentist.get(t.dentist_user_id) ?? null) : null;

  const fee = t.value_pence;
  const lab = Math.round((fee * (labPct ?? 0)) / 100);
  const dentist = Math.round(((fee - lab) * (sharePct ?? 0)) / 100);
  return {
    feePence: fee,
    labPence: lab,
    dentistPence: dentist,
    marginPence: fee - lab - dentist,
    incomplete: labPct == null || (t.dentist_user_id != null && sharePct == null),
  };
}

export function addMargin(total: MarginBreakdown, m: MarginBreakdown): MarginBreakdown {
  return {
    feePence: total.feePence + m.feePence,
    labPence: total.labPence + m.labPence,
    dentistPence: total.dentistPence + m.dentistPence,
    marginPence: total.marginPence + m.marginPence,
    incomplete: total.incomplete || m.incomplete,
  };
}

/** Margin as a share of fees, 0–1, or null with no fees. */
export function marginRate(m: MarginBreakdown): number | null {
  return m.feePence > 0 ? m.marginPence / m.feePence : null;
}
