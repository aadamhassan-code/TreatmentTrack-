import { describe, expect, test } from "vitest";
import { decideSend, type StepToSend } from "@/lib/send-decision";

const base: StepToSend = {
  channel: "sms",
  practiceStatus: "active",
  treatmentStatus: "in_sequence",
  patient: { phone: "+447700900123", email: "p@example.com", opted_out_at: null },
  channelEnabled: true,
  hasTemplate: true,
  providerConfigured: true,
  scheduledFor: "2026-10-10T08:00:00Z",
};
const NOW = new Date("2026-10-10T09:00:00Z");

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

  test("a channel switched off in Settings after scheduling is canceled, not sent", () => {
    expect(decideSend({ ...base, channel: "email", channelEnabled: false })).toEqual({
      action: "cancel",
      reason: "Email follow-up is turned off in Settings",
    });
  });

  test("opt-out still wins over a switched-off channel", () => {
    expect(
      decideSend({
        ...base,
        channelEnabled: false,
        patient: { ...base.patient!, opted_out_at: "2026-01-01T00:00:00Z" },
      })
    ).toEqual({ action: "skip_no_consent" });
  });

  test("a due message waits while sending isn't connected yet", () => {
    expect(decideSend({ ...base, providerConfigured: false }, NOW)).toEqual({ action: "wait" });
  });

  test("…but gives up once it's more than 7 days overdue", () => {
    const d = decideSend({ ...base, providerConfigured: false, scheduledFor: "2026-10-02T08:00:00Z" }, NOW);
    expect(d.action).toBe("fail");
  });

  test("opt-out still wins while waiting for a connection", () => {
    expect(
      decideSend({ ...base, providerConfigured: false, patient: { ...base.patient!, opted_out_at: "2026-01-01T00:00:00Z" } }, NOW)
    ).toEqual({ action: "skip_no_consent" });
  });

  test("a dentist-first account waits for the practice owner's approval", () => {
    expect(decideSend({ ...base, awaitingOwnerApproval: true }, NOW)).toEqual({ action: "wait" });
    const late = decideSend({ ...base, awaitingOwnerApproval: true, scheduledFor: "2026-10-01T08:00:00Z" }, NOW);
    expect(late.action).toBe("fail");
    expect(late.action === "fail" && late.reason).toContain("hadn't approved");
  });

  test("missing template fails", () => {
    expect(decideSend({ ...base, hasTemplate: false }).action).toBe("fail");
  });
});
