import { describe, expect, test } from "vitest";
import { buildDentistPerformance, monthlyBooked, type PerfTreatment } from "@/lib/performance";
import { estimateMargin, type MarginInputs } from "@/lib/margins";

const boards: MarginInputs["boards"] = [
  { id: "imp", name: "Implants", keywords: ["implant"], is_default: false, position: 0, lab_cost_pct: 20 },
  { id: "other", name: "Other", keywords: [], is_default: true, position: 9, lab_cost_pct: null },
];

const t = (over: Partial<PerfTreatment>): PerfTreatment => ({
  treatment_type: "Implant UL6",
  value_pence: 250_000,
  status: "in_sequence",
  quoted_on: "2026-10-01",
  converted_at: null,
  dentist_user_id: "dr-a",
  ...over,
});

describe("estimateMargin", () => {
  test("lab cost comes off the fee first, then the dentist's share of what's left", () => {
    const m = estimateMargin(t({}), { boards, shareByDentist: new Map([["dr-a", 50]]) });
    // £2,500 fee, 20% lab = £500, dentist 50% of £2,000 = £1,000, practice keeps £1,000.
    expect(m).toEqual({ feePence: 250_000, labPence: 50_000, dentistPence: 100_000, marginPence: 100_000, incomplete: false });
  });

  test("missing inputs count as 0% and are flagged", () => {
    const noShare = estimateMargin(t({}), { boards, shareByDentist: new Map() });
    expect(noShare.dentistPence).toBe(0);
    expect(noShare.incomplete).toBe(true);
    const noLab = estimateMargin(t({ treatment_type: "Whitening" }), { boards, shareByDentist: new Map([["dr-a", 50]]) });
    expect(noLab.labPence).toBe(0);
    expect(noLab.incomplete).toBe(true);
  });

  test("an unassigned quote has no dentist share and isn't flagged for it", () => {
    const m = estimateMargin(t({ dentist_user_id: null }), { boards, shareByDentist: new Map() });
    expect(m.dentistPence).toBe(0);
    expect(m.incomplete).toBe(false);
  });
});

describe("buildDentistPerformance", () => {
  const data: PerfTreatment[] = [
    t({ status: "converted", quoted_on: "2026-10-01", converted_at: "2026-10-11T10:00:00Z" }),
    t({ status: "converted", quoted_on: "2026-08-20", converted_at: "2026-10-05T10:00:00Z", value_pence: 100_000 }),
    t({ status: "in_sequence", quoted_on: "2026-10-03", value_pence: 300_000 }),
    t({ status: "lost", quoted_on: "2026-10-04", value_pence: 80_000 }),
    t({ status: "converted", quoted_on: "2026-10-02", converted_at: "2026-10-03T10:00:00Z", dentist_user_id: "dr-b", value_pence: 50_000 }),
  ];

  test("counts quotes made, bookings, recovered revenue, days to book and open pipeline per dentist", () => {
    const rows = buildDentistPerformance(data, "2026-10-01");
    const a = rows.find((r) => r.dentistUserId === "dr-a")!;
    expect(a.quoted).toEqual({ count: 3, valuePence: 630_000 });
    expect(a.booked).toEqual({ count: 1, valuePence: 250_000 });
    expect(a.bookingRate).toBeCloseTo(1 / 3);
    // Both bookings land in October, including the August quote.
    expect(a.recovered).toEqual({ count: 2, valuePence: 350_000 });
    expect(a.avgDaysToBook).toBe(Math.round((10 + 46) / 2));
    expect(a.open).toEqual({ count: 1, valuePence: 300_000 });
    expect(a.margin).toBeNull();
    expect(rows[0].dentistUserId).toBe("dr-a"); // most recovered first
  });

  test("adds estimated margin when margin inputs are given", () => {
    const rows = buildDentistPerformance(data, "2026-10-01", { boards, shareByDentist: new Map([["dr-a", 50]]) });
    const a = rows.find((r) => r.dentistUserId === "dr-a")!;
    expect(a.margin?.feePence).toBe(350_000);
    expect(a.margin?.marginPence).toBe(Math.round(350_000 * 0.8 * 0.5));
  });
});

describe("monthlyBooked", () => {
  test("buckets bookings into the last 12 UK calendar months, oldest first", () => {
    const points = monthlyBooked(
      [
        t({ status: "converted", converted_at: "2026-10-11T10:00:00Z" }),
        t({ status: "converted", converted_at: "2026-09-30T23:30:00Z", value_pence: 10_000 }), // 1 Oct in London (BST)
        t({ status: "converted", converted_at: "2025-01-01T10:00:00Z" }), // too old
        t({ status: "lost", converted_at: null }),
      ],
      "2026-10-19"
    );
    expect(points).toHaveLength(12);
    expect(points[0].month).toBe("2025-11");
    expect(points[11]).toMatchObject({ month: "2026-10", label: "Oct", bookedCount: 2, bookedPence: 260_000 });
  });
});
