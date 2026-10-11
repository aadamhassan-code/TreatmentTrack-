import { describe, expect, test } from "vitest";
import { describeDays, planSchedule, scheduleProblem, SCHEDULE_PRESETS } from "@/lib/schedule";

describe("follow-up schedule", () => {
  test("presets are all valid", () => {
    for (const p of SCHEDULE_PRESETS) expect(scheduleProblem(p.days)).toBeNull();
  });

  test.each([
    [[], "at least one"],
    [[3, 7, 14, 30, 60, 90, 120], "up to 6"],
    [[0, 7], "between 1 and 365"],
    [[3, 400], "between 1 and 365"],
    [[7, 3], "after the one before"],
    [[3, 3], "after the one before"],
    [[3.5], "between 1 and 365"],
  ])("%j is refused (%s)", (days, message) => {
    expect(scheduleProblem(days as number[])).toContain(message);
  });

  test.each([
    [1, "1 day"],
    [3, "3 days"],
    [7, "1 week"],
    [14, "2 weeks"],
    [30, "1 month"],
    [60, "2 months"],
    [45, "45 days"],
  ])("describeDays(%i) = %s", (d, text) => expect(describeDays(d)).toBe(text));

  const start = new Date("2027-01-02T08:00:00Z");
  const iso = (rows: { step: number; at: Date }[]) => rows.map((r) => [r.step, r.at.toISOString().slice(0, 10)]);

  test("a new quote's messages go the chosen number of days after it", () => {
    expect(iso(planSchedule([3, 7, 30], start))).toEqual([
      [1, "2027-01-05"],
      [2, "2027-01-09"],
      [3, "2027-02-01"],
    ]);
  });

  test("after a pause the first message goes on the resume date, keeping the spacing", () => {
    expect(iso(planSchedule([3, 7, 30], start, { startNow: true }))).toEqual([
      [1, "2027-01-02"],
      [2, "2027-01-06"],
      [3, "2027-01-29"],
    ]);
  });
});
