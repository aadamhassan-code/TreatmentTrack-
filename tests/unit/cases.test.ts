import { describe, expect, test } from "vitest";
import {
  boardProblem,
  buildCaseReport,
  daysAtStage,
  describeDuration,
  isStuck,
  parseKeywords,
  pickBoard,
  type BoardInput,
} from "@/lib/cases";

const now = new Date("2026-10-18T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe("stuck cases", () => {
  test("counts whole days at the current stage", () => {
    expect(daysAtStage(ago(0.5), now)).toBe(0);
    expect(daysAtStage(ago(3), now)).toBe(3);
  });

  test("overdue only once past the stage's usual time, and only while active", () => {
    const stage = { expected_days: 14 };
    expect(isStuck({ status: "active", stage_entered_at: ago(14) }, stage, now)).toBe(false);
    expect(isStuck({ status: "active", stage_entered_at: ago(15) }, stage, now)).toBe(true);
    expect(isStuck({ status: "completed", stage_entered_at: ago(90) }, stage, now)).toBe(false);
    expect(isStuck({ status: "active", stage_entered_at: ago(90) }, { expected_days: null }, now)).toBe(false);
    expect(isStuck({ status: "active", stage_entered_at: ago(90) }, undefined, now)).toBe(false);
  });

  test("durations read naturally", () => {
    expect(describeDuration(0)).toBe("today");
    expect(describeDuration(1)).toBe("1 day");
    expect(describeDuration(7)).toBe("1 week");
    expect(describeDuration(14)).toBe("2 weeks");
    expect(describeDuration(90)).toBe("90 days");
  });
});

describe("choosing a board for a booked quote", () => {
  const boards = [
    { id: "other", keywords: [], is_default: true, position: 5 },
    { id: "crowns", keywords: ["crown", "veneer"], is_default: false, position: 3 },
    { id: "implants", keywords: ["implant"], is_default: false, position: 1 },
  ];
  test.each([
    ["Implant crown UL6", "implants"],
    ["Porcelain veneers x6", "crowns"],
    ["CROWN", "crowns"],
    ["Root canal", "other"],
  ])("%s → %s", (type, id) => {
    expect(pickBoard(boards, type)?.id).toBe(id);
  });
});

describe("editing a board", () => {
  const board = (patch: Partial<BoardInput> = {}): BoardInput => ({
    name: "Dentures",
    keywords: "denture",
    stages: [
      { name: "Impressions", expectedDays: 14 },
      { name: "Try-in", expectedDays: null },
    ],
    ...patch,
  });

  test("a sensible board is fine", () => {
    expect(boardProblem(board(), false)).toBeNull();
  });

  test.each<[string, Partial<BoardInput>, RegExp]>([
    ["no name", { name: " " }, /name/],
    ["no matching words", { keywords: "" }, /at least one word/],
    ["no stages", { stages: [] }, /at least one stage/],
    ["a blank stage", { stages: [{ name: "", expectedDays: null }] }, /Stage 1 needs a name/],
    ["a Completed stage", { stages: [{ name: "Completed", expectedDays: null }] }, /added for you/],
    ["duplicate stages", { stages: [{ name: "Fit", expectedDays: null }, { name: "fit", expectedDays: null }] }, /two stages/],
    ["0 days", { stages: [{ name: "Fit", expectedDays: 0 }] }, /between 1 and/],
    ["too many stages", { stages: Array.from({ length: 13 }, (_, i) => ({ name: `S${i}`, expectedDays: null })) }, /up to 12/],
  ])("rejects %s", (_, patch, message) => {
    expect(boardProblem(board(patch), false)).toMatch(message);
  });

  test("the catch-all board doesn't need matching words", () => {
    expect(boardProblem(board({ keywords: "" }), true)).toBeNull();
  });

  test("matching words are tidied and de-duplicated", () => {
    expect(parseKeywords(" Aligner, invisalign ,, ALIGNER ")).toEqual(["aligner", "invisalign"]);
  });
});

describe("treatment progress report", () => {
  const stages = [{ id: "heal", expected_days: 90 }];
  const c = (patch: object) => ({
    board_id: "implants",
    stage_id: "heal",
    status: "active" as const,
    stage_entered_at: ago(10),
    completed_at: null as string | null,
    created_at: ago(200),
    value_pence: 250000,
    ...patch,
  });

  test("counts active, overdue and completed-in-period cases per board, with average time", () => {
    const rows = buildCaseReport(
      [
        c({}),
        c({ stage_entered_at: ago(100) }),
        c({ status: "completed", created_at: ago(130), completed_at: ago(10) }),
        c({ status: "completed", created_at: ago(200), completed_at: ago(20) }),
        c({ status: "completed", created_at: ago(400), completed_at: ago(300) }),
        c({ board_id: "whitening", status: "completed", created_at: ago(30), completed_at: ago(2), value_pence: 30000 }),
      ],
      stages,
      "2026-09-01",
      now
    );
    expect(rows).toEqual([
      { boardId: "implants", active: 2, stuck: 1, completed: 2, completedValuePence: 500000, averageDays: 150 },
      { boardId: "whitening", active: 0, stuck: 0, completed: 1, completedValuePence: 30000, averageDays: 28 },
    ]);
  });
});
