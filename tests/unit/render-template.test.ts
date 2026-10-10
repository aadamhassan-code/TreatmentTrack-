import { describe, expect, test } from "vitest";
import { renderTemplate } from "@/lib/utils";

const vars = { patientName: "Priya", treatmentType: "implant", practiceName: "Smile Dental" };

describe("renderTemplate", () => {
  test("fills in the dentist's name", () => {
    expect(renderTemplate("Hi {patientName}, {dentistName} asked us to check in", { ...vars, dentistName: "Dr Patel" })).toBe(
      "Hi Priya, Dr Patel asked us to check in"
    );
  });

  test("falls back to 'your dentist' when the quote has no dentist", () => {
    expect(renderTemplate("{dentistName} at {practiceName}", { ...vars, dentistName: null })).toBe(
      "your dentist at Smile Dental"
    );
  });
});
