import { describe, expect, test } from "vitest";
import { buildReport, parsePeriod, periodStart, type ReportTreatment } from "@/lib/reports";

const t = (over: Partial<ReportTreatment>): ReportTreatment => ({
  treatment_type: "Crown",
  value_pence: 100_00,
  status: "in_sequence",
  quoted_on: "2026-10-05",
  converted_at: null,
  ...over,
});

describe("buildReport", () => {
  const rows = [
    t({ treatment_type: "Implant", value_pence: 2400_00, status: "converted", converted_at: "2026-10-08T10:00:00Z" }),
    t({ treatment_type: "Implant", value_pence: 2000_00, status: "declined" }),
    t({ value_pence: 800_00, status: "lost" }),
    t({ value_pence: 900_00 }),
    // Quoted last month but booked this month: counts as recovered this month,
    // but its quote belongs to last month's figures.
    t({ value_pence: 500_00, quoted_on: "2026-09-20", status: "converted", converted_at: "2026-10-02T09:00:00Z" }),
  ];

  test("groups quotes made in the period by outcome", () => {
    const r = buildReport(rows, "2026-10-01");
    expect(r.quoted).toEqual({ count: 4, valuePence: 6100_00 });
    expect(r.booked).toEqual({ count: 1, valuePence: 2400_00 });
    expect(r.declined).toEqual({ count: 1, valuePence: 2000_00 });
    expect(r.lost).toEqual({ count: 1, valuePence: 800_00 });
    expect(r.open).toEqual({ count: 1, valuePence: 900_00 });
    expect(r.bookingRate).toBe(0.25);
  });

  test("a booking just after midnight UK time on the 1st counts in the new month", () => {
    const r = buildReport(
      [t({ status: "converted", quoted_on: "2026-09-01", converted_at: "2026-09-30T23:30:00Z" })],
      "2026-10-01"
    );
    expect(r.recovered.count).toBe(1);
  });

  test("recovered counts everything booked in the period, whenever it was quoted", () => {
    expect(buildReport(rows, "2026-10-01").recovered).toEqual({ count: 2, valuePence: 2900_00 });
  });

  test("breaks down by treatment type, highest quoted value first", () => {
    const r = buildReport(rows, "2026-10-01");
    expect(r.byTreatment.map((x) => [x.treatmentType, x.quoted.count, x.booked.count, x.bookingRate])).toEqual([
      ["Implant", 2, 1, 0.5],
      ["Crown", 2, 0, 0],
    ]);
  });

  test("all time includes everything", () => {
    expect(buildReport(rows, null).quoted.count).toBe(5);
  });

  test("no quotes gives no booking rate rather than 0%", () => {
    expect(buildReport([], "2026-10-01").bookingRate).toBeNull();
  });
});

describe("report periods", () => {
  const today = "2026-10-09";
  test.each([
    ["month", "2026-10-01"],
    ["90d", "2026-07-12"],
    ["12m", "2025-10-10"],
    ["all", null],
  ] as const)("%s starts on %s", (period, start) => {
    expect(periodStart(period, today)).toBe(start);
  });

  test("unknown period falls back to this month", () => {
    expect(parsePeriod("forever")).toBe("month");
    expect(parsePeriod(undefined)).toBe("month");
  });
});
