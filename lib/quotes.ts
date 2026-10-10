import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scheduleSequence } from "@/lib/sequence";
import { OPEN_STATUSES } from "@/lib/types";

export type QuoteSource = "csv_import" | "dentally";

export interface QuoteInput<K> {
  /** The caller's reference for this quote (a CSV row number, a Dentally candidate id…). */
  key: K;
  patientName: string;
  /** Already normalised to +44… */
  phone: string;
  email: string | null;
  treatmentType: string;
  valuePence: number;
  /** "YYYY-MM-DD" */
  quotedOn: string;
  /** e.g. the Dentally treatment plan id, so bookings can be matched back. */
  externalId?: string | null;
}

export interface SaveQuotesResult<K> {
  error?: string;
  saved: { key: K; treatmentId: string; valuePence: number }[];
  skipped: { key: K; reason: string }[];
}

const CHUNK = 200;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Saves a batch of quotes the way Add Treatment saves one: find-or-create
 * the patient by phone, record a fresh quote-followup consent for each
 * quote (the PECR soft opt-in staff have just confirmed), create the
 * treatment against it, and schedule its follow-up messages. Runs as the
 * signed-in staff member, so row-level security and the database's consent
 * checks apply unchanged.
 *
 * Skips patients who have opted out (re-consent is one patient at a time,
 * from Add Treatment) and quotes already open for the same patient,
 * treatment and value, so re-running an import never duplicates.
 */
export async function saveQuotes<K>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  opts: {
    practiceId: string;
    userId: string;
    source: QuoteSource;
    consentNote: (q: QuoteInput<K>) => string;
    quotes: QuoteInput<K>[];
  }
): Promise<SaveQuotesResult<K>> {
  const { practiceId, userId, source, consentNote, quotes } = opts;
  const skipped: SaveQuotesResult<K>["skipped"] = [];

  const phones = Array.from(new Set(quotes.map((q) => q.phone)));
  const existing = new Map<string, { id: string; email: string | null; opted_out_at: string | null }>();
  for (const batch of chunks(phones)) {
    const { data, error } = await supabase
      .from("patients")
      .select("id, phone, email, opted_out_at")
      .eq("practice_id", practiceId)
      .in("phone", batch);
    if (error) return { error: "Couldn't check existing patients. Nothing was saved — please try again.", saved: [], skipped };
    for (const p of data ?? []) existing.set(p.phone, p);
  }

  const openQuotes = new Set<string>();
  const existingIds = Array.from(existing.values()).map((p) => p.id);
  for (const batch of chunks(existingIds)) {
    const { data, error } = await supabase
      .from("treatments")
      .select("patient_id, treatment_type, value_pence")
      .eq("practice_id", practiceId)
      .in("status", OPEN_STATUSES)
      .in("patient_id", batch);
    if (error) return { error: "Couldn't check existing quotes. Nothing was saved — please try again.", saved: [], skipped };
    for (const t of data ?? []) openQuotes.add(`${t.patient_id}|${t.treatment_type.toLowerCase()}|${t.value_pence}`);
  }

  const toSave: (QuoteInput<K> & { patientId: string })[] = [];
  const newPatients = new Map<string, { id: string; practice_id: string; full_name: string; phone: string; email: string | null }>();
  const emailBackfill = new Map<string, string>();

  for (const q of quotes) {
    const known = existing.get(q.phone);
    if (known?.opted_out_at) {
      skipped.push({
        key: q.key,
        reason:
          "This patient opted out of follow-up messages. If they've asked to hear from you again, add this quote from Add Treatment.",
      });
      continue;
    }
    if (known && openQuotes.has(`${known.id}|${q.treatmentType.toLowerCase()}|${q.valuePence}`)) {
      skipped.push({ key: q.key, reason: "Already on your dashboard as an open quote" });
      continue;
    }

    let patientId = known?.id ?? newPatients.get(q.phone)?.id;
    if (!patientId) {
      patientId = crypto.randomUUID();
      newPatients.set(q.phone, { id: patientId, practice_id: practiceId, full_name: q.patientName, phone: q.phone, email: q.email });
    }
    if (known && !known.email && q.email) emailBackfill.set(known.id, q.email);
    toSave.push({ ...q, patientId });
  }

  if (toSave.length === 0) return { saved: [], skipped };

  const fail = (what: string, e: { message: string }): SaveQuotesResult<K> => {
    console.error(`saveQuotes (${source}): ${what}`, e);
    return {
      error: `Something went wrong saving ${what}, so this stopped partway. Check the dashboard before trying again — trying again won't duplicate quotes that did get saved.`,
      saved: [],
      skipped,
    };
  };

  for (const batch of chunks(Array.from(newPatients.values()))) {
    const { error } = await supabase.from("patients").insert(batch);
    if (error) return fail("patients", error);
  }
  for (const [id, email] of emailBackfill) {
    await supabase.from("patients").update({ email }).eq("id", id).is("email", null);
  }

  const records = toSave.map((q) => ({ q, consentId: crypto.randomUUID(), treatmentId: crypto.randomUUID() }));

  for (const batch of chunks(records)) {
    const { error } = await supabase.from("consents").insert(
      batch.map(({ q, consentId }) => ({
        id: consentId,
        practice_id: practiceId,
        patient_id: q.patientId,
        category: "quote_followup",
        granted: true,
        captured_by: userId,
        notes: consentNote(q),
      }))
    );
    if (error) return fail("consent records", error);
  }

  for (const batch of chunks(records)) {
    const { error } = await supabase.from("treatments").insert(
      batch.map(({ q, consentId, treatmentId }) => ({
        id: treatmentId,
        practice_id: practiceId,
        patient_id: q.patientId,
        treatment_type: q.treatmentType,
        value_pence: q.valuePence,
        quoted_on: q.quotedOn,
        status: "in_sequence",
        source,
        external_id: q.externalId ?? null,
        quote_followup_consent_id: consentId,
        created_by: userId,
      }))
    );
    if (error) return fail("quotes", error);
  }

  try {
    await scheduleSequence(supabase, practiceId, records.map((r) => r.treatmentId));
  } catch (e) {
    return fail("follow-up messages", e as Error);
  }

  return {
    saved: records.map((r) => ({ key: r.q.key, treatmentId: r.treatmentId, valuePence: r.q.valuePence })),
    skipped,
  };
}
