"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentPractice } from "@/lib/practice";
import { scheduleSequence } from "@/lib/sequence";
import { parseImport, type ImportRow } from "@/lib/import";
import { OPEN_STATUSES } from "@/lib/types";
import { ukDate } from "@/lib/utils";

export interface ImportResult {
  error?: string;
  imported?: number;
  importedValuePence?: number;
  skipped?: { line: number; patientName: string; reason: string }[];
}

const MAX_FILE_CHARS = 900_000;
const CHUNK = 200;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Imports a CSV of quotes. The file is re-read and re-checked here — the
 * browser's preview is only a convenience. Each imported quote gets its own
 * quote-followup consent record (the PECR soft opt-in), exactly like Add
 * Treatment, so the database's consent checks apply unchanged.
 */
export async function importTreatments(csvText: string, optOutConfirmed: boolean): Promise<ImportResult> {
  const { userId, practice } = await requireCurrentPractice();
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
  const skip = (row: ImportRow, reason: string) =>
    skipped.push({ line: row.line, patientName: row.patientName, reason });

  const valid: ImportRow[] = [];
  for (const row of rows) {
    if (row.errors.length) skip(row, row.errors.join("; "));
    else valid.push(row);
  }

  // Patients this practice already has, matched by phone (as Add Treatment does).
  const phones = Array.from(new Set(valid.map((r) => r.phone)));
  const existing = new Map<string, { id: string; email: string | null; opted_out_at: string | null }>();
  for (const batch of chunks(phones)) {
    const { data, error } = await supabase
      .from("patients")
      .select("id, phone, email, opted_out_at")
      .eq("practice_id", practice.id)
      .in("phone", batch);
    if (error) return { error: "Couldn't check existing patients. Nothing was imported — please try again." };
    for (const p of data ?? []) existing.set(p.phone, p);
  }

  // Quotes already open for those patients, so re-importing the same file
  // doesn't create duplicates.
  const openQuotes = new Set<string>();
  const existingIds = Array.from(existing.values()).map((p) => p.id);
  for (const batch of chunks(existingIds)) {
    const { data, error } = await supabase
      .from("treatments")
      .select("patient_id, treatment_type, value_pence")
      .eq("practice_id", practice.id)
      .in("status", OPEN_STATUSES)
      .in("patient_id", batch);
    if (error) return { error: "Couldn't check existing quotes. Nothing was imported — please try again." };
    for (const t of data ?? []) {
      openQuotes.add(`${t.patient_id}|${t.treatment_type.toLowerCase()}|${t.value_pence}`);
    }
  }

  const toImport: (ImportRow & { patientId: string })[] = [];
  const newPatients = new Map<string, { id: string; practice_id: string; full_name: string; phone: string; email: string | null }>();
  const emailBackfill = new Map<string, string>();

  for (const row of valid) {
    const known = existing.get(row.phone);
    if (known?.opted_out_at) {
      // Re-consent has to be recorded one patient at a time, by a person.
      skip(row, "This patient opted out of follow-up messages. If they've asked to hear from you again, add this quote from Add Treatment.");
      continue;
    }
    if (known && openQuotes.has(`${known.id}|${row.treatmentType.toLowerCase()}|${row.valuePence}`)) {
      skip(row, "Already on your dashboard as an open quote");
      continue;
    }

    let patientId = known?.id ?? newPatients.get(row.phone)?.id;
    if (!patientId) {
      patientId = crypto.randomUUID();
      newPatients.set(row.phone, {
        id: patientId,
        practice_id: practice.id,
        full_name: row.patientName,
        phone: row.phone,
        email: row.email,
      });
    }
    if (known && !known.email && row.email) emailBackfill.set(known.id, row.email);
    toImport.push({ ...row, patientId });
  }

  if (toImport.length === 0) {
    return { imported: 0, importedValuePence: 0, skipped: skipped.sort((a, b) => a.line - b.line) };
  }

  const fail = (what: string, e: { message: string }) => {
    console.error(`CSV import: ${what}`, e);
    return {
      error: `Something went wrong saving ${what}, so the import stopped partway. Check the dashboard before trying again — re-importing the same file won't create duplicates of quotes that did get saved.`,
    };
  };

  for (const batch of chunks(Array.from(newPatients.values()))) {
    const { error } = await supabase.from("patients").insert(batch);
    if (error) return fail("patients", error);
  }
  for (const [id, email] of emailBackfill) {
    await supabase.from("patients").update({ email }).eq("id", id).is("email", null);
  }

  const records = toImport.map((row) => ({
    row,
    consentId: crypto.randomUUID(),
    treatmentId: crypto.randomUUID(),
  }));

  for (const batch of chunks(records)) {
    const { error } = await supabase.from("consents").insert(
      batch.map(({ row, consentId }) => ({
        id: consentId,
        practice_id: practice.id,
        patient_id: row.patientId,
        category: "quote_followup",
        granted: true,
        captured_by: userId,
        notes: `Imported from CSV on ${today}. Staff confirmed an opt-out was offered for follow-up on this ${row.treatmentType} quote.`,
      }))
    );
    if (error) return fail("consent records", error);
  }

  for (const batch of chunks(records)) {
    const { error } = await supabase.from("treatments").insert(
      batch.map(({ row, consentId, treatmentId }) => ({
        id: treatmentId,
        practice_id: practice.id,
        patient_id: row.patientId,
        treatment_type: row.treatmentType,
        value_pence: row.valuePence,
        quoted_on: row.quotedOn,
        status: "in_sequence",
        source: "csv_import",
        quote_followup_consent_id: consentId,
        created_by: userId,
      }))
    );
    if (error) return fail("quotes", error);
  }

  try {
    await scheduleSequence(supabase, practice.id, records.map((r) => r.treatmentId));
  } catch (e) {
    return fail("follow-up messages", e as Error);
  }

  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return {
    imported: records.length,
    importedValuePence: records.reduce((sum, r) => sum + r.row.valuePence, 0),
    skipped: skipped.sort((a, b) => a.line - b.line),
  };
}
