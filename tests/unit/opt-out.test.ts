import { describe, expect, test } from "vitest";
import { isStopMessage } from "@/lib/opt-out";
import { ensureOptOutText } from "@/lib/messaging/provider";
import { normalizePhone } from "@/lib/utils";

describe("isStopMessage", () => {
  test.each(["STOP", "stop", " Stop. ", "STOPALL", "Unsubscribe", "cancel", "END", "quit", "opt out", "OPT-OUT"])(
    "%j opts the patient out",
    (body) => expect(isStopMessage(body)).toBe(true)
  );

  test.each(["Stop texting me please", "unsubscribe me"])("%j opts the patient out", (body) =>
    expect(isStopMessage(body)).toBe(true)
  );

  test.each(["", "Yes please book me in", "How much is it?", "Can I cancel my appointment on Friday", "Don't stop"])(
    "%j does not",
    (body) => expect(isStopMessage(body)).toBe(false)
  );
});

describe("ensureOptOutText", () => {
  test("adds an SMS opt-out when the template has none", () => {
    expect(ensureOptOutText("Hi Sam", "sms")).toBe("Hi Sam Reply STOP to opt out.");
  });
  test("adds an email unsubscribe line when the template has none", () => {
    expect(ensureOptOutText("Hi Sam", "email")).toMatch(/unsubscribe/);
  });
  test("leaves a template that already has an opt-out alone", () => {
    expect(ensureOptOutText("Hi Sam. Reply STOP to opt out.", "whatsapp")).toBe(
      "Hi Sam. Reply STOP to opt out."
    );
  });
});

describe("normalizePhone", () => {
  test.each([
    ["07700 900123", "+447700900123"],
    ["+44 7700 900123", "+447700900123"],
    ["447700900123", "+447700900123"],
    ["(07700) 900-123", "+447700900123"],
  ])("%j → %j", (input, expected) => expect(normalizePhone(input)).toBe(expected));
});
