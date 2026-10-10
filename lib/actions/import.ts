"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listTreatingDentists, requireCurrentPractice } from "@/lib/practice";
import { normaliseDentistName, parseImport, type ImportRow } from "@/lib/import";
import { saveQuotes } from "@/lib/quotes";
import { ukDate } from "@/lib/utils";

export interface ImportResult {
  error?: string;
  imported?: number;
  importedValuePence?: number;
  skipped?: { line: number; patientName: string; reason: string }[];
}

const MAX_FILE_CHARS = 900_000;

/**
 * Imports a CSV of quotes. The file is re-read and re-checked here — the
 * browser's preview is only a convenience. Each imported quote gets its own
 * quote-followup consent record (the PECR soft opt-in), exactly like Add
 * Treatment, so the database's consent checks apply unchanged.
 */
export async function importTreatments(csvText: string, optOutConfirmed: boolean): Promise<ImportResult> {
  const { userId, practice, role } = await requireCurrentPractice();
  const supabase = await createClient();

  if (!optOutConfirmed) {
    return {
      error:
        "Please confirm every patient in this file was offered an opt-out for follow-up on their quote. Remove any who weren't before importing.",
    };
  }
  if (csvText.length > MAX_FILE_CHARS) {
    return { error: "That file is too large. Please split it into smaller files of up to 500 quotes." };
  }

  const today = ukDate();
  const { fileErrors, rows } = parseImport(csvText, today);
  if (fileErrors.length) return { error: fileErrors[0] };

  const skipped: NonNullable<ImportResult["skipped"]> = [];
  const byLine = new Map(rows.map((r) => [r.line, r]));
  const skip = (row: ImportRow, reason: string) =>
    skipped.push({ line: row.line, patientName: row.patientName, reason });

  // Who each quote belongs to: a Dentist login's imports are always theirs;
  // otherwise an optional dentist column is matched to the team's names.
  const dentists = await listTreatingDentists(practice.id);
  const byName = new Map(dentists.map((d) => [normaliseDentistName(d.name), d.userId]));
  const dentistFor = (row: ImportRow): string | null | undefined => {
    if (role === "dentist") return userId;
    if (!row.dentistName) return null;
    return byName.get(normaliseDentistName(row.dentistName));
  };

  const valid: (ImportRow & { dentistUserId: string | null })[] = [];
  for (const row of rows) {
    const dentistUserId = dentistFor(row);
    if (row.errors.length) skip(row, row.errors.join("; "));
    else if (dentistUserId === undefined) {
      skip(row, `"${row.dentistName}" doesn't match a dentist on your team — check the name on the Team page`);
    } else valid.push({ ...row, dentistUserId });
  }

  const result = await saveQuotes(supabase, {
    practiceId: practice.id,
    userId,
    source: "csv_import",
    consentNote: (q) =>
      `Imported from CSV on ${today}. Staff confirmed an opt-out was offered for follow-up on this ${q.treatmentType} quote.`,
    quotes: valid.map((r) => ({ ...r, key: r.line })),
  });
  if (result.error) return { error: result.error };
  for (const s of result.skipped) skip(byLine.get(s.key)!, s.reason);

  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return {
    imported: result.saved.length,
    importedValuePence: result.saved.reduce((sum, r) => sum + r.valuePence, 0),
    skipped: skipped.sort((a, b) => a.line - b.line),
  };
}
