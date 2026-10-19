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

describe("mobile numbers", () => {
  test.each([
    ["07700 900123", true],
    ["+44 7700 900123", true],
    ["020 7946 0000", false],
    ["01632 960123", false],
    ["+353 85 123 4567", true],
  ])("%s textable: %s", async (raw, ok) => {
    const { isTextableNumber, normalizePhone } = await import("@/lib/utils");
    expect(isTextableNumber(normalizePhone(raw))).toBe(ok);
  });

  test("a landline in an import is flagged", () => {
    const { rows } = parseImport(`${header}\nJo,020 7946 0000,,Crown,100,`, TODAY);
    expect(rows[0].errors.join()).toContain("isn't a mobile number");
  });
});

describe("CareStack Treatment Tracker export", () => {
  const head =
    "Patient Name,Patient ID,Facility,Email,Mobile Number,Proposed Date,Tx Location,Tx Provider,Date of Service,Code,Code Description,Tooth/Area,Surface,Code Status,Scheduled Status,Appt Date,Est. Fee,Last DOS";
  const row = (name: string, mobile: string, date: string, desc: string, status: string, sched: string, fee: string) =>
    `${name},P1,,${name.split(" ")[0].toLowerCase()}@example.com,${mobile},${date},DIN,Dr Sam Patel,,X1,${desc},UL6,,${status},${sched},,"${fee}",`;

  test("imports as downloaded, one quote per patient visit", () => {
    const csv = [
      head,
      row("Jo Bloggs", "07700 900123", "01/10/2026", "Implant - single", "Accepted", "Unscheduled", "£2,000.00"),
      row("Jo Bloggs", "07700 900123", "01/10/2026", "Implant crown", "Accepted", "Unscheduled", "£800.00"),
      row("Ann Lee", "07700 900456", "02/10/2026", "Veneer", "Proposed", "Unscheduled", "£450.00"),
    ].join("\n");
    const { fileErrors, rows } = parseImport(csv, TODAY);
    expect(fileErrors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      patientName: "Jo Bloggs",
      phone: "+447700900123",
      treatmentType: "Implant - single + Implant crown",
      valuePence: 280000,
      quotedOn: "2026-10-01",
      dentistName: "Dr Sam Patel",
      mergedLines: [3],
      errors: [],
    });
    expect(rows[1]).toMatchObject({ patientName: "Ann Lee", valuePence: 45000, errors: [] });
  });

  test("skips items already scheduled, completed or rejected", () => {
    const csv = [
      head,
      row("A One", "07700 900001", "01/10/2026", "Crown", "Accepted", "Scheduled", "500"),
      row("B Two", "07700 900002", "01/10/2026", "Crown", "Completed", "Unscheduled", "500"),
      row("C Three", "07700 900003", "01/10/2026", "Crown", "Rejected", "Unscheduled", "500"),
    ].join("\n");
    expect(parseImport(csv, TODAY).rows.map((r) => r.errors[0])).toEqual([
      "Already booked in (scheduled)",
      "Treatment already completed",
      "Patient turned this treatment down",
    ]);
  });
});

describe("CareStack UK export (real column layout, made-up patients)", () => {
  const csv = [
    "Patient Name,Patient ID,Facility,Email,Mobile Number,Proposed Date,Tx Location,Tx Clinician,Date Of Service,Code,Code Description,Tooth/ Area,Surface,Code Status,Scheduled Status,Appt Date,Est. Fee,Last Date of Service",
    `"Test Patient","1","","test@example.com", +44-7700900111,24/09/2026,"STAG","Dr. Sam Patel",,"1421","Composite Filling","UL2","M","Proposed","Unscheduled",,"£199.00",08/10/2026`,
    `"Test Patient","1","","test@example.com", +44-7700900111,24/09/2026,"STAG","Dr. Sam Patel",,"Crown-P","Crown - Porcelain","UL1","","Proposed","Unscheduled",,"£1,000.00",08/10/2026`,
    `"Test Patient","1","","test@example.com", +44-7700900111,24/09/2026,"STAG","Dr. Sam Patel",,"Crown-P","Crown - Porcelain","UR1","","Proposed","Unscheduled",,"£1,000.00",08/10/2026`,
    `"Other Patient","2","","", +44-7700900222,12/05/2026,"STAG","Dr. Sam Patel",,"2706","Fit Denture","","","Proposed","Unscheduled",,"£1,000.00",01/10/2026`,
    `"Other Patient","2","","", +44-7700900222,12/05/2026,"STAG","Dr. Sam Patel",,"2706","Fit Denture","","","Proposed","Unscheduled",,"£1,000.00",01/10/2026`,
  ].join("\n");

  test("repeated items on one visit are counted and their fees added", () => {
    const { fileErrors, rows } = parseImport(csv, "2026-10-19");
    expect(fileErrors).toEqual([]);
    expect(rows.map((r) => [r.treatmentType, r.valuePence, r.phone, r.dentistName, r.errors])).toEqual([
      ["Composite Filling + Crown - Porcelain ×2", 219900, "+447700900111", "Dr. Sam Patel", []],
      ["Fit Denture ×2", 200000, "+447700900222", "Dr. Sam Patel", []],
    ]);
  });
});

describe("header aliases from other practice software", () => {
  test("recognises common headings from Aerona/iSmile/Pearl-style exports", () => {
    const csv =
      "Patient's Name,Mobile No,Treatment Description,Estimate,Date of Quote\n" +
      "Asha Patel,07700 900900,Composite bonding,£850,01/10/2026\n";
    const { fileErrors, rows } = parseImport(csv, "2026-10-18");
    expect(fileErrors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].patientName).toBe("Asha Patel");
    expect(rows[0].phone).toBe("+447700900900");
    expect(rows[0].treatmentType).toBe("Composite bonding");
    expect(rows[0].valuePence).toBe(85000);
    expect(rows[0].quotedOn).toBe("2026-10-01");
  });
});
