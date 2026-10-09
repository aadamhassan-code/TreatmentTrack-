import { describe, expect, test } from "vitest";
import { TEMPLATE_CSV, parseImport, parsePounds, parseUkDate } from "@/lib/import";

const TODAY = "2026-10-09";
const header = "patient_name,phone,email,treatment_type,value,quote_date";

describe("parseImport", () => {
  test("the downloadable template imports cleanly", () => {
    const { fileErrors, rows } = parseImport(TEMPLATE_CSV, TODAY);
    expect(fileErrors).toEqual([]);
    expect(rows.map((r) => r.errors)).toEqual([[], []]);
    expect(rows[0]).toMatchObject({
      line: 2,
      patientName: "Fatima Ahmed",
      phone: "+447700900123",
      email: "fatima@example.com",
      treatmentType: "Dental implant",
      valuePence: 240000,
      quotedOn: "2026-10-01",
    });
    expect(rows[1].email).toBeNull();
  });

  test("recognises common alternative column names in any order", () => {
    // Excel wraps amounts containing commas in quotes.
    const quoted = parseImport('Amount,Mobile Number,Treatment,Full Name\n"£1,200",07700900123,Crown,Jo Bloggs', TODAY);
    expect(quoted.rows[0]).toMatchObject({ patientName: "Jo Bloggs", valuePence: 120000, quotedOn: TODAY, errors: [] });
  });

  test("names missing required columns", () => {
    expect(parseImport("name,phone\nJo,07700900123", TODAY).fileErrors[0]).toMatch(/treatment type, value/);
  });

  test("refuses files over 500 quotes", () => {
    const body = Array.from({ length: 501 }, (_, i) => `P${i},0770090${String(i).padStart(4, "0")},,Crown,100,`).join("\n");
    expect(parseImport(`${header}\n${body}`, TODAY).fileErrors[0]).toMatch(/at most 500/);
  });

  test.each([
    ["Jo,,,Crown,100,", "Missing phone number"],
    ["Jo,12345,,Crown,100,", "doesn't look like a phone number"],
    ["Jo,07700900123,not-an-email,Crown,100,", "doesn't look like an email"],
    ["Jo,07700900123,,Crown,free,", "isn't a valid amount"],
    ["Jo,07700900123,,Crown,0,", "isn't a valid amount"],
    ["Jo,07700900123,,Crown,100,31/02/2026", "isn't a date we recognise"],
    ["Jo,07700900123,,Crown,100,01/01/2027", "in the future"],
    ["Jo,07700900123,,Crown,100,01/09/2025", "more than 12 months old"],
    [",07700900123,,Crown,100,", "Missing patient name"],
  ])("flags %s", (line, message) => {
    const { rows } = parseImport(`${header}\n${line}`, TODAY);
    expect(rows[0].errors.join("; ")).toContain(message);
  });

  test("when the file has an opt-out column, every row must say yes", () => {
    const csv = "name,phone,treatment,value,opt_out_offered\nA,07700900001,Crown,100,yes\nB,07700900002,Crown,100,no\nC,07700900003,Crown,100,";
    expect(parseImport(csv, TODAY).rows.map((r) => r.errors.length > 0)).toEqual([false, true, true]);
  });

  test("flags a repeated row so the same quote isn't imported twice", () => {
    const csv = `${header}\nJo,07700900123,,Crown,100,\nJo,07700 900123,,crown,100,\nJo,07700900123,,Crown,200,`;
    expect(parseImport(csv, TODAY).rows.map((r) => r.errors)).toEqual([
      [],
      ["Same patient, treatment and value as an earlier row"],
      [],
    ]);
  });
});

describe("value and date parsing", () => {
  test.each([
    ["2400", 240000],
    ["£2,400.50", 240050],
    ["2400.5", 240050],
    ["-5", null],
    ["12abc", null],
  ])("parsePounds(%j) = %j", (raw, pence) => expect(parsePounds(raw)).toBe(pence));

  test.each([
    ["01/10/2026", "2026-10-01"],
    ["1/10/26", "2026-10-01"],
    ["01.10.2026", "2026-10-01"],
    ["2026-10-01", "2026-10-01"],
    ["13/13/2026", null],
    ["October 1st", null],
  ])("parseUkDate(%j) = %j", (raw, iso) => expect(parseUkDate(raw)).toBe(iso));
});
