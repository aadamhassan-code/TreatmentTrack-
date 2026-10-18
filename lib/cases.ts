import { ukDate } from "@/lib/utils";

/**
 * The Cases board: once a patient books, their treatment is tracked stage
 * by stage until it's completed. Admin progress only — never clinical notes.
 */

export type CaseStatus = "active" | "completed" | "stopped";

export interface CaseStage {
  id: string;
  board_id: string;
  name: string;
  expected_days: number | null;
  position: number;
}

export interface CaseBoard {
  id: string;
  name: string;
  keywords: string[];
  is_default: boolean;
  position: number;
  stages: CaseStage[];
}

export interface CaseRow {
  id: string;
  board_id: string | null;
  stage_id: string | null;
  status: CaseStatus;
  treatment_id: string | null;
  patient_name: string;
  treatment_type: string;
  value_pence: number;
  dentist_user_id: string | null;
  note: string | null;
  stage_entered_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface CaseEvent {
  case_id: string;
  kind: "started" | "moved" | "completed" | "stopped" | "reopened";
  stage_name: string | null;
  by_name: string | null;
  created_at: string;
}

const DAY_MS = 86_400_000;

/** Whole days since the case reached its current stage. */
export function daysAtStage(stageEnteredAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(stageEnteredAt)) / DAY_MS));
}

/** An active case that has sat at its stage longer than the stage usually takes. */
export function isStuck(c: Pick<CaseRow, "status" | "stage_entered_at">, stage: Pick<CaseStage, "expected_days"> | undefined, now: Date = new Date()): boolean {
  return c.status === "active" && !!stage?.expected_days && daysAtStage(c.stage_entered_at, now) > stage.expected_days;
}

/** The moment `days` days ago, as an ISO timestamp. */
export function daysAgo(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

export function describeDuration(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  if (days % 7 === 0 && days < 70) return days === 7 ? "1 week" : `${days / 7} weeks`;
  return `${days} days`;
}

// ---------------------------------------------------------------------------
// Editing boards (Settings)
// ---------------------------------------------------------------------------

export const MAX_STAGES = 12;
export const MAX_BOARDS = 20;
export const MAX_EXPECTED_DAYS = 730;

export interface BoardInput {
  id?: string;
  name: string;
  /** Comma-separated words, e.g. "implant" or "aligner, invisalign". */
  keywords: string;
  stages: { id?: string; name: string; expectedDays: number | null }[];
}

export function parseKeywords(raw: string): string[] {
  const words = raw
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(words)];
}

/** What's wrong with a board as entered, in plain words, or null if it's fine. */
export function boardProblem(board: BoardInput, isDefault: boolean): string | null {
  const name = board.name.trim();
  if (!name) return "Give the board a name.";
  if (name.length > 60) return "Board names can be up to 60 characters.";
  const keywords = parseKeywords(board.keywords);
  if (keywords.length > 20) return "Use up to 20 matching words.";
  if (keywords.some((k) => k.length > 40)) return "Matching words can be up to 40 characters each.";
  if (!isDefault && keywords.length === 0) {
    return `Add at least one word that appears in the treatment type (e.g. "implant"), so booked quotes go on "${name}".`;
  }
  if (board.stages.length === 0) return "Add at least one stage before Completed.";
  if (board.stages.length > MAX_STAGES) return `A board can have up to ${MAX_STAGES} stages.`;
  for (const [i, s] of board.stages.entries()) {
    const stageName = s.name.trim();
    if (!stageName) return `Stage ${i + 1} needs a name.`;
    if (stageName.length > 60) return `Stage "${stageName.slice(0, 20)}…" is too long (60 characters at most).`;
    if (stageName.toLowerCase() === "completed") return `"Completed" is added for you as the last column — remove stage ${i + 1}.`;
    if (s.expectedDays != null && (!Number.isInteger(s.expectedDays) || s.expectedDays < 1 || s.expectedDays > MAX_EXPECTED_DAYS)) {
      return `"Usually takes" for ${stageName} must be between 1 and ${MAX_EXPECTED_DAYS} days, or left blank.`;
    }
  }
  const names = board.stages.map((s) => s.name.trim().toLowerCase());
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) return `There are two stages called "${board.stages[names.indexOf(dup)].name.trim()}".`;
  return null;
}

/** Which board a booked quote goes on — mirrors pick_case_board() in the database. */
export function pickBoard<B extends Pick<CaseBoard, "id" | "keywords" | "is_default" | "position">>(
  boards: B[],
  treatmentType: string
): B | undefined {
  const type = treatmentType.toLowerCase();
  const sorted = [...boards].sort((a, b) => Number(a.is_default) - Number(b.is_default) || a.position - b.position);
  return sorted.find((b) => b.is_default || b.keywords.some((k) => k.trim() && type.includes(k.trim().toLowerCase())));
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface CaseReportRow {
  boardId: string | null;
  active: number;
  stuck: number;
  completed: number;
  completedValuePence: number;
  /** Average days from going on the board to completed, for cases completed in the period. */
  averageDays: number | null;
}

/**
 * Per board: cases in progress now, how many are stuck, and cases completed
 * since `from` (a UK "YYYY-MM-DD" date, or null for all time).
 */
export function buildCaseReport(
  cases: Pick<CaseRow, "board_id" | "stage_id" | "status" | "stage_entered_at" | "completed_at" | "created_at" | "value_pence">[],
  stages: Pick<CaseStage, "id" | "expected_days">[],
  from: string | null,
  now: Date = new Date()
): CaseReportRow[] {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const rows = new Map<string | null, CaseReportRow & { totalDays: number }>();
  const row = (boardId: string | null) => {
    let r = rows.get(boardId);
    if (!r) {
      r = { boardId, active: 0, stuck: 0, completed: 0, completedValuePence: 0, averageDays: null, totalDays: 0 };
      rows.set(boardId, r);
    }
    return r;
  };
  for (const c of cases) {
    if (c.status === "active") {
      const r = row(c.board_id);
      r.active++;
      if (isStuck(c, c.stage_id ? stageById.get(c.stage_id) : undefined, now)) r.stuck++;
    } else if (c.status === "completed" && c.completed_at && (!from || ukDate(c.completed_at) >= from)) {
      const r = row(c.board_id);
      r.completed++;
      r.completedValuePence += c.value_pence;
      r.totalDays += Math.max(0, (Date.parse(c.completed_at) - Date.parse(c.created_at)) / DAY_MS);
    }
  }
  return [...rows.values()].map(({ totalDays, ...r }) => ({
    ...r,
    averageDays: r.completed ? Math.round(totalDays / r.completed) : null,
  }));
}
