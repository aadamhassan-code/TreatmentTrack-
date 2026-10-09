import { describe, expect, test } from "vitest";
import { displayStatus } from "@/lib/treatment-status";
import type { Patient } from "@/lib/types";

const patient = { opted_out_at: null } as Patient;
const optedOut = { opted_out_at: "2026-01-01T00:00:00Z" } as Patient;

describe("displayStatus — what the dashboard calls a quote", () => {
  test("a quote with messages still to send is in sequence", () => {
    expect(
      displayStatus({ status: "in_sequence", patient, sequence_steps: [{ status: "pending", error: null }] })
    ).toBe("in_sequence");
  });

  test("a patient who has opted out shows as opted out", () => {
    expect(
      displayStatus({ status: "in_sequence", patient: optedOut, sequence_steps: [{ status: "pending", error: null }] })
    ).toBe("opted_out");
  });

  test("a quote whose messages were cancelled by STOP stays opted out after re-consent elsewhere", () => {
    expect(
      displayStatus({
        status: "in_sequence",
        patient,
        sequence_steps: [
          { status: "canceled", error: "Patient opted out" },
          { status: "canceled", error: "Patient opted out" },
        ],
      })
    ).toBe("opted_out");
  });

  test("all messages sent or failed means the sequence has finished", () => {
    expect(
      displayStatus({
        status: "in_sequence",
        patient,
        sequence_steps: [
          { status: "sent", error: null },
          { status: "failed", error: "Twilio SMS is not connected yet." },
        ],
      })
    ).toBe("messages_finished");
  });

  test.each(["converted", "lost", "future_intent"] as const)("stored status %s is shown as-is", (status) => {
    expect(displayStatus({ status, patient: optedOut, sequence_steps: [] })).toBe(status);
  });
});
