"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listTreatingDentists, requireCurrentPractice, requireOwner } from "@/lib/practice";
import { MAX_BOARDS, boardProblem, parseKeywords, type BoardInput } from "@/lib/cases";

export interface CaseActionResult {
  error?: string;
}

function refresh() {
  revalidatePath("/cases");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

/** Moves a case to another stage on its board, or to Completed. */
export async function moveCase(caseId: string, to: string | "completed"): Promise<CaseActionResult> {
  const { practice } = await requireCurrentPractice();
  const supabase = await createClient();
  const update = to === "completed" ? { status: "completed" } : { status: "active", stage_id: to };
  const { data, error } = await supabase
    .from("cases")
    .update(update)
    .eq("id", caseId)
    .eq("practice_id", practice.id)
    .neq("status", "stopped")
    .select("id");
  if (error || !data?.length) return { error: "Couldn't move that case. Please refresh and try again." };
  refresh();
  return {};
}

/** Puts a case on a different board (e.g. it landed on "Other treatment"), at that board's first stage. */
export async function moveCaseToBoard(caseId: string, boardId: string): Promise<CaseActionResult> {
  const { practice } = await requireCurrentPractice();
  const supabase = await createClient();
  const { data: first } = await supabase
    .from("case_stages")
    .select("id")
    .eq("board_id", boardId)
    .eq("practice_id", practice.id)
    .order("position")
    .limit(1)
    .maybeSingle();
  if (!first) return { error: "That board has no stages yet." };
  const { data, error } = await supabase
    .from("cases")
    .update({ board_id: boardId, stage_id: first.id, status: "active" })
    .eq("id", caseId)
    .eq("practice_id", practice.id)
    .neq("status", "stopped")
    .select("id");
  if (error || !data?.length) return { error: "Couldn't move that case. Please refresh and try again." };
  refresh();
  return {};
}

export async function saveCaseNote(caseId: string, note: string): Promise<CaseActionResult> {
  const { practice } = await requireCurrentPractice();
  const text = note.trim();
  if (text.length > 280) return { error: "Notes can be up to 280 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cases")
    .update({ note: text || null })
    .eq("id", caseId)
    .eq("practice_id", practice.id)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't save the note. Please try again." };
  refresh();
  return {};
}

/** Takes a case off the board (e.g. the patient stopped treatment). Kept in history, not deleted. */
export async function stopCase(caseId: string): Promise<CaseActionResult> {
  const { practice } = await requireCurrentPractice();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cases")
    .update({ status: "stopped" })
    .eq("id", caseId)
    .eq("practice_id", practice.id)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't remove that case. Please try again." };
  refresh();
  return {};
}

/**
 * Adds a patient to a board by hand — e.g. they said yes at the
 * consultation, so there was never a quote to follow up. Only what's
 * needed to track the case: name, treatment, value and dentist.
 */
export async function addCase(formData: FormData): Promise<CaseActionResult> {
  const { practice, role, userId } = await requireCurrentPractice();
  const patientName = String(formData.get("patientName") ?? "").trim();
  const treatmentType = String(formData.get("treatmentType") ?? "").trim();
  const valueRaw = String(formData.get("value") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "");
  const stageId = String(formData.get("stageId") ?? "");

  if (!patientName || !treatmentType) return { error: "Please enter the patient's name and the treatment." };
  if (patientName.length > 120 || treatmentType.length > 120) return { error: "Name and treatment can be up to 120 characters." };
  const value = valueRaw ? Number(valueRaw) : 0;
  if (!Number.isFinite(value) || value < 0) return { error: "Please enter the value in pounds, or leave it blank." };

  let dentistUserId: string | null = role === "dentist" ? userId : String(formData.get("dentistUserId") ?? "") || null;
  if (dentistUserId && role !== "dentist") {
    const allowed = await listTreatingDentists(practice.id);
    if (!allowed.some((d) => d.userId === dentistUserId)) dentistUserId = null;
  }

  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("case_stages")
    .select("id")
    .eq("board_id", boardId)
    .eq("practice_id", practice.id)
    .order("position");
  if (!stages?.length) return { error: "Please choose a board." };
  const stage = stages.find((s) => s.id === stageId) ?? stages[0];

  const { error } = await supabase.from("cases").insert({
    practice_id: practice.id,
    board_id: boardId,
    stage_id: stage.id,
    patient_name: patientName,
    treatment_type: treatmentType,
    value_pence: Math.round(value * 100),
    dentist_user_id: dentistUserId,
    created_by: userId,
  });
  if (error) {
    console.error("Failed to add case", error);
    return { error: "Couldn't add that case. Please try again." };
  }
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Owners: boards and their stages (Settings)
// ---------------------------------------------------------------------------

export async function setCasesAutoStart(on: boolean): Promise<CaseActionResult> {
  const { practice } = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update({ cases_auto_start: on }).eq("practice_id", practice.id);
  if (error) return { error: "Couldn't save that. Please try again." };
  revalidatePath("/settings");
  return {};
}

/**
 * Creates or updates a board and its stages. Stages keep their identity
 * when renamed or reordered, so cases on them stay put; a stage removed
 * from the list is deleted, which the database refuses while it still has
 * active cases.
 */
export async function saveBoard(input: BoardInput): Promise<CaseActionResult & { saved?: BoardInput }> {
  const { practice } = await requireOwner();
  const supabase = await createClient();

  const { data: boards } = await supabase
    .from("case_boards")
    .select("id, is_default, position")
    .eq("practice_id", practice.id);
  const existing = input.id ? boards?.find((b) => b.id === input.id) : undefined;
  if (input.id && !existing) return { error: "That board no longer exists. Please refresh." };
  if (!input.id && (boards?.length ?? 0) >= MAX_BOARDS) return { error: `You can have up to ${MAX_BOARDS} boards.` };

  const problem = boardProblem(input, Boolean(existing?.is_default));
  if (problem) return { error: problem };

  const fields = { name: input.name.trim(), keywords: parseKeywords(input.keywords) };
  let boardId = existing?.id;
  if (existing) {
    const { error } = await supabase.from("case_boards").update(fields).eq("id", existing.id);
    if (error) return { error: "Couldn't save the board. Please try again." };
  } else {
    // New boards go before the catch-all "Other treatment" board.
    const nonDefault = (boards ?? []).filter((b) => !b.is_default);
    const position = Math.max(0, ...nonDefault.map((b) => b.position)) + 1;
    const { data, error } = await supabase
      .from("case_boards")
      .insert({ practice_id: practice.id, ...fields, position })
      .select("id")
      .single();
    if (error || !data) return { error: "Couldn't create the board. Please try again." };
    boardId = data.id as string;
    for (const b of boards ?? []) {
      if (b.is_default && b.position <= position) {
        await supabase.from("case_boards").update({ position: position + 1 }).eq("id", b.id);
      }
    }
  }

  const { data: current } = await supabase.from("case_stages").select("id").eq("board_id", boardId!);
  const keep = new Set(input.stages.map((s) => s.id).filter(Boolean));
  const removed = (current ?? []).filter((s) => !keep.has(s.id));
  for (const s of removed) {
    const { error } = await supabase.from("case_stages").delete().eq("id", s.id);
    if (error) {
      return {
        error: error.message.includes("active cases")
          ? "A stage you removed still has patients on it. Move them to another stage on the Cases board first, then remove it."
          : "Couldn't remove a stage. Please try again.",
      };
    }
  }

  for (const [i, s] of input.stages.entries()) {
    const row = { name: s.name.trim(), expected_days: s.expectedDays, position: i + 1 };
    const { error } =
      s.id && (current ?? []).some((c) => c.id === s.id)
        ? await supabase.from("case_stages").update(row).eq("id", s.id).eq("board_id", boardId!)
        : await supabase.from("case_stages").insert({ ...row, board_id: boardId, practice_id: practice.id });
    if (error) return { error: "Couldn't save the stages. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/cases");
  // Hand back the stages with their ids, so saving again updates them in place.
  const { data: stages } = await supabase
    .from("case_stages")
    .select("id, name, expected_days")
    .eq("board_id", boardId!)
    .order("position");
  return {
    saved: {
      id: boardId,
      name: fields.name,
      keywords: fields.keywords.join(", "),
      stages: (stages ?? []).map((s) => ({ id: s.id as string, name: s.name as string, expectedDays: s.expected_days as number | null })),
    },
  };
}

export async function deleteBoard(boardId: string): Promise<CaseActionResult> {
  const { practice } = await requireOwner();
  const supabase = await createClient();
  const { data: board } = await supabase
    .from("case_boards")
    .select("is_default")
    .eq("id", boardId)
    .eq("practice_id", practice.id)
    .maybeSingle();
  if (!board) return { error: "That board no longer exists." };
  if (board.is_default) return { error: "The catch-all board can't be deleted — booked quotes that match no other board go there." };
  const { error } = await supabase.from("case_boards").delete().eq("id", boardId);
  if (error) {
    return {
      error: error.message.includes("active cases")
        ? "This board still has patients on it. Complete them or move them to another board first."
        : "Couldn't delete the board. Please try again.",
    };
  }
  revalidatePath("/settings");
  revalidatePath("/cases");
  return {};
}
