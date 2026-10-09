import { describe, expect, test } from "vitest";
import { decideSend, type StepToSend } from "@/lib/send-decision";

const base: StepToSend = {
  channel: "sms",
  practiceStatus: "active",
  treatmentStatus: "in_sequence",
  patient: { phone: "+447700900123", email: "p@example.com", opted_out_at: null },
  hasTemplate: true,
};

describe("decideSend — re-checked at the moment of sending", () => {
  test("sends a normal due SMS to the patient's phone", () => {
    expect(decideSend(base)).toEqual({ action: "send", to: "+447700900123" });
  });

  test("email goes to the email address", () => {
    expect(decideSend({ ...base, channel: "email" })).toEqual({ action: "send", to: "p@example.com" });
  });

  test("an opted-out patient is never messaged", () => {
    expect(
      decideSend({ ...base, patient: { ...base.patient!, opted_out_at: "2026-01-01T00:00:00Z" } })
    ).toEqual({ action: "skip_no_consent" });
  });

  test("opt-out wins even if everything else is also wrong", () => {
    expect(
      decideSend({
        ...base,
        practiceStatus: "canceled",
        hasTemplate: false,
        patient: { ...base.patient!, opted_out_at: "2026-01-01T00:00:00Z" },
      })
    ).toEqual({ action: "skip_no_consent" });
  });

  test.each(["canceled", "pending_payment", null])("practice status %j stops sending", (status) => {
    expect(decideSend({ ...base, practiceStatus: status }).action).toBe("cancel");
  });

  test("past_due practices keep sending during Stripe's retry period", () => {
    expect(decideSend({ ...base, practiceStatus: "past_due" }).action).toBe("send");
  });

  test.each(["converted", "lost", "future_intent"])("treatment status %j stops sending", (status) => {
    expect(decideSend({ ...base, treatmentStatus: status }).action).toBe("cancel");
  });

  test("no email on file fails the email step", () => {
    expect(
      decideSend({ ...base, channel: "email", patient: { ...base.patient!, email: null } })
    ).toEqual({ action: "fail", reason: "No email contact on file" });
  });

  test("missing template fails", () => {
    expect(decideSend({ ...base, hasTemplate: false }).action).toBe("fail");
  });
});
