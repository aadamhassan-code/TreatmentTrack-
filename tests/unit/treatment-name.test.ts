import { describe, expect, test } from "vitest";
import { patientTreatmentName } from "@/lib/treatment-name";
import { renderTemplate } from "@/lib/utils";

describe("treatment names in patient messages", () => {
  test.each([
    ["Dental implant", "Dental implant"],
    ["Invisalign", "Invisalign"],
    ["Composite Filling + Bridge Pontic - Acid Etch + Crown - Porcelain ×2", "treatment plan (filling, bridge and crowns)"],
    ["Fit Denture ×2", "treatment plan (dentures)"],
    ["Implant - single + Implant crown", "treatment plan (implant)"],
    ["Implant - single ×2 + Implant crown ×2", "treatment plan (implants)"],
    ["Crown - Porcelain + Crown - Porcelain ×2", "treatment plan (crowns)"],
    ["Periodontal Treatment + Composite Filling", "treatment plan (gum treatment and filling)"],
    ["Mystery Procedure - code X + Crown", "treatment plan (mystery procedure and crown)"],
  ])("%s → %s", (stored, shown) => {
    expect(patientTreatmentName(stored)).toBe(shown);
  });

  test("messages use the friendly name", () => {
    const text = renderTemplate("Hi {patientName}, about the {treatmentType} we quoted at {practiceName}.", {
      patientName: "Jo",
      treatmentType: "Crown - Porcelain ×2 + Composite Filling",
      practiceName: "Stag Dental",
    });
    expect(text).toBe("Hi Jo, about the treatment plan (crowns and filling) we quoted at Stag Dental.");
  });
});
