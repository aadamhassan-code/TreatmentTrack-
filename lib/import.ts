import { parseCsv } from "@/lib/csv";
import { normalizePhone } from "@/lib/utils";

export const MAX_IMPORT_ROWS = 500;
/** Older quotes than this aren't imported: the patient is unlikely to expect a follow-up. */
export const MAX_QUOTE_AGE_MONTHS = 12;

export const TEMPLATE_CSV =
  "patient_name,phone,email,treatment_type,value,quote_date,opt_out_offered\n" +
  "Fatima Ahmed,07700 900123,fatima@example.com,Dental implant,2400,01/10/2026,yes\n" +
  "James Wilson,07700 900456,,Invisalign,3200,15/09/2026,yes\n";

type Field = "patientName" | "phone" | "email" | "treatmentType" | "value" | "quoteDate" | "optOutOffered";

// Header names we recognise, after lower-casing and removing spaces/punctuation.
const HEADER_ALIASES: Record<Field, string[]> = {
  patientName: ["patientname", "name", "patient", "fullname", "patientfullname"],
  phone: ["phone", "mobile", "mobilenumber", "phonenumber", "telephone", "tel", "mobilephone"],
  email: ["email", "emailaddress", "patientemail"],
  treatmentType: ["treatmenttype", "treatment", "treatmentplan", "procedure", "item"],
  value: ["value", "quotedvalue", "quotevalue", "amount", "price", "fee", "total", "cost"],
  quoteDate: ["quotedate", "quotedon", "date", "datequoted", "plandate"],
  optOutOffered: ["optoutoffered", "optout", "consent", "softoptin"],
};

const REQUIRED: { field: Field; label: string }[] = [
  { field: "patientName", label: "patient name" },
  { field: "phone", label: "phone" },
  { field: "treatmentType", label: "treatment type" },
  { field: "value", label: "value" },
];

export interface ImportRow {
  /** Line number in the spreadsheet (the header is line 1). */
  line: number;
  patientName: string;
  phone: string;
  email: string | null;
  treatmentType: string;
  valuePence: number;
  /** "YYYY-MM-DD" */
  quotedOn: string;
  errors: string[];
}

export interface ParsedImport {
  /** Problems with the file as a whole; if any, nothing can be imported. */
  fileErrors: string[];
  rows: ImportRow[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YES = new Set(["yes", "y", "true", "1", "x", "✓"]);

function normaliseHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z]/g, "");
}

/** "£2,400.50" → 240050. Returns null if it isn't a positive amount. */
export function parsePounds(raw: string): number | null {
  const cleaned = raw.replace(/[£,\s]/g, "").replace(/^gbp/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const pence = Math.round(Number(cleaned) * 100);
  return pence > 0 ? pence : null;
}

/**
 * Accepts UK-style dates (01/10/2026, 1/10/26, 01-10-2026, 01.10.2026) and
 * ISO dates (2026-10-01). Returns "YYYY-MM-DD", or null if it isn't a real date.
 */
export function parseUkDate(raw: string): string | null {
  let d: number, m: number, y: number;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const uk = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (uk) [d, m, y] = [Number(uk[1]), Number(uk[2]), Number(uk[3])];
  else return null;
  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

function monthsBefore(today: string, months: number) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/**
 * Reads a CSV of quotes and checks every row. Used twice: in the browser to
 * show staff a preview, and again on the server before anything is saved
 * (the server never trusts the browser's version).
 */
export function parseImport(text: string, today: string): ParsedImport {
  const table = parseCsv(text);
  if (table.length === 0) return { fileErrors: ["The file is empty."], rows: [] };

  const [header, ...body] = table;
  const columns = new Map<Field, number>();
  header.forEach((h, i) => {
    const key = normaliseHeader(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [Field, string[]][]) {
      if (!columns.has(field) && aliases.includes(key)) columns.set(field, i);
    }
  });

  const missing = REQUIRED.filter((r) => !columns.has(r.field)).map((r) => r.label);
  if (missing.length) {
    return {
      fileErrors: [
        `Couldn't find a column for ${missing.join(", ")}. The first row of the file must be column headings — download the template to see the expected format.`,
      ],
      rows: [],
    };
  }
  if (body.length === 0) return { fileErrors: ["The file has headings but no quotes."], rows: [] };
  if (body.length > MAX_IMPORT_ROWS) {
    return {
      fileErrors: [`The file has ${body.length} quotes. Please import at most ${MAX_IMPORT_ROWS} at a time.`],
      rows: [],
    };
  }

  const cell = (r: string[], f: Field) => (columns.has(f) ? (r[columns.get(f)!] ?? "").trim() : "");
  const oldest = monthsBefore(today, MAX_QUOTE_AGE_MONTHS);
  const seen = new Set<string>();

  const rows = body.map((r, i): ImportRow => {
    const errors: string[] = [];
    const patientName = cell(r, "patientName");
    const rawPhone = cell(r, "phone");
    const phone = rawPhone ? normalizePhone(rawPhone) : "";
    const email = cell(r, "email").toLowerCase() || null;
    const treatmentType = cell(r, "treatmentType");
    const rawValue = cell(r, "value");
    const valuePence = parsePounds(rawValue);
    const rawDate = cell(r, "quoteDate");
    const quotedOn = rawDate ? parseUkDate(rawDate) : today;

    if (!patientName) errors.push("Missing patient name");
    if (!rawPhone) errors.push("Missing phone number");
    else if (!/^\+\d{10,15}$/.test(phone)) errors.push(`"${rawPhone}" doesn't look like a phone number`);
    if (email && !EMAIL_RE.test(email)) errors.push(`"${email}" doesn't look like an email address`);
    if (!treatmentType) errors.push("Missing treatment type");
    if (!rawValue) errors.push("Missing value");
    else if (valuePence == null) errors.push(`"${rawValue}" isn't a valid amount`);
    if (!quotedOn) errors.push(`"${rawDate}" isn't a date we recognise — use DD/MM/YYYY`);
    else if (quotedOn > today) errors.push("Quote date is in the future");
    else if (quotedOn < oldest) errors.push(`Quote is more than ${MAX_QUOTE_AGE_MONTHS} months old`);

    // If the file records whether an opt-out was offered, every row must say yes.
    if (columns.has("optOutOffered") && !YES.has(cell(r, "optOutOffered").toLowerCase())) {
      errors.push("Opt-out column doesn't say yes for this quote");
    }

    const key = `${phone}|${treatmentType.toLowerCase()}|${valuePence}`;
    if (errors.length === 0) {
      if (seen.has(key)) errors.push("Same patient, treatment and value as an earlier row");
      seen.add(key);
    }

    return {
      line: i + 2,
      patientName,
      phone,
      email,
      treatmentType,
      valuePence: valuePence ?? 0,
      quotedOn: quotedOn ?? today,
      errors,
    };
  });

  return { fileErrors: [], rows };
}
