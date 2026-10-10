import { describe, expect, test } from "vitest";
import { planDentallySync } from "@/lib/integrations/dentally-sync";
import type {
  DentallyApi,
  DentallyPatient,
  DentallyTreatmentPlan,
  DentallyTreatmentPlanItem,
} from "@/lib/integrations/dentally";

const NOW = new Date("2026-10-10T09:00:00Z");

function plan(over: Partial<DentallyTreatmentPlan>): DentallyTreatmentPlan {
  return {
    id: 1,
    practitioner_id: 16,
    completed: false,
    created_at: "2026-10-01T10:00:00Z",
    start_date: "2026-10-01",
    nickname: null,
    patient_id: 100,
    private_treatment_value: "2400.0",
    updated_at: "2026-10-05T10:00:00Z",
    ...over,
  };
}

function item(over: Partial<DentallyTreatmentPlanItem>): DentallyTreatmentPlanItem {
  return {
    id: Math.random(),
    completed: false,
    nomenclature: "Implant",
    patient_nomenclature: "Dental implant",
    price: "2000.0",
    treatment_appointment_id: null,
    treatment_plan_id: 1,
    ...over,
  };
}

function patient(over: Partial<DentallyPatient> = {}): DentallyPatient {
  return {
    id: 100,
    active: true,
    first_name: "Priya",
    last_name: "Shah",
    mobile_phone: "07700 900201",
    email_address: "Priya@Example.com",
    marketing: true,
    use_sms: true,
    use_email: true,
    ...over,
  };
}

function fakeApi(data: {
  plans: DentallyTreatmentPlan[];
  items: DentallyTreatmentPlanItem[];
  patients: DentallyPatient[];
  recentItems?: DentallyTreatmentPlanItem[];
}): DentallyApi & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async getUser() {
      return { email: "x@example.com", first_name: "X", last_name: "Y" };
    },
    async listTreatmentPlans({ completed }) {
      calls.push(`plans completed=${completed}`);
      return data.plans.filter((p) => p.completed === completed);
    },
    async listTreatmentPlanItems({ treatment_plan_id, updated_after }) {
      if (updated_after) return data.recentItems ?? [];
      return data.items.filter((i) => String(i.treatment_plan_id) === treatment_plan_id);
    },
    async listPractitioners() {
      return [];
    },
    async getPatient(id) {
      calls.push(`patient ${id}`);
      const p = data.patients.find((x) => String(x.id) === id);
      if (!p) throw new Error("not found");
      return p;
    },
  };
}

describe("planDentallySync", () => {
  test("an unbooked private plan becomes a candidate with patient details", async () => {
    const api = fakeApi({
      plans: [plan({})],
      items: [item({ price: "2000.0" }), item({ patient_nomenclature: "Crown", price: "400.0" }), item({ patient_nomenclature: "Exam", price: "0.0" })],
      patients: [patient()],
    });
    const { candidates, bookedPlanIds } = await planDentallySync(api, { since: null, now: NOW });
    expect(bookedPlanIds.size).toBe(0);
    expect(candidates).toEqual([
      {
        externalPlanId: "1",
        externalPatientId: "100",
        externalPractitionerId: "16",
        patientName: "Priya Shah",
        phone: "+447700900201",
        email: "priya@example.com",
        treatmentType: "Dental implant + Crown",
        valuePence: 240000,
        quotedOn: "2026-10-01",
        blockedReason: null,
      },
    ]);
  });

  test("a plan with an item booked into an appointment is treated as booked, not a candidate", async () => {
    const api = fakeApi({
      plans: [plan({})],
      items: [item({ treatment_appointment_id: 555 })],
      patients: [patient()],
    });
    const { candidates, bookedPlanIds } = await planDentallySync(api, { since: null, now: NOW });
    expect(candidates).toEqual([]);
    expect([...bookedPlanIds]).toEqual(["1"]);
  });

  test("plans booked or completed since the last sync are reported so follow-up can stop", async () => {
    const api = fakeApi({
      plans: [plan({ id: 9, completed: true })],
      items: [],
      patients: [],
      recentItems: [item({ treatment_plan_id: 7, treatment_appointment_id: 1 }), item({ treatment_plan_id: 8 })],
    });
    const { bookedPlanIds } = await planDentallySync(api, { since: "2026-10-09T07:30:00Z", now: NOW });
    expect([...bookedPlanIds].sort()).toEqual(["7", "9"]);
  });

  test.each([
    [{ marketing: false }, "Marketing is switched off"],
    [{ marketing: 0 }, "Marketing is switched off"],
    [{ use_sms: false }, "asked not to receive texts"],
    [{ mobile_phone: null }, "No valid mobile number"],
    [{ mobile_phone: "12345" }, "No valid mobile number"],
  ] as const)("patient %j is shown but blocked", async (over, reason) => {
    const api = fakeApi({ plans: [plan({})], items: [item({})], patients: [patient(over as Partial<DentallyPatient>)] });
    const { candidates } = await planDentallySync(api, { since: null, now: NOW });
    expect(candidates[0].blockedReason).toContain(reason);
  });

  test("email is left out if the patient doesn't want emails", async () => {
    const api = fakeApi({ plans: [plan({})], items: [item({})], patients: [patient({ use_email: false })] });
    expect((await planDentallySync(api, { since: null, now: NOW })).candidates[0].email).toBeNull();
  });

  test("NHS-only plans, archived patients and plans over 12 months old are ignored", async () => {
    const api = fakeApi({
      plans: [
        plan({ id: 1, private_treatment_value: "0.0" }),
        plan({ id: 2, patient_id: 200 }),
        plan({ id: 3, start_date: "2025-09-01" }),
      ],
      items: [item({ treatment_plan_id: 1 }), item({ treatment_plan_id: 2 }), item({ treatment_plan_id: 3 })],
      patients: [patient({ id: 200, active: false })],
    });
    expect((await planDentallySync(api, { since: null, now: NOW })).candidates).toEqual([]);
  });

  test("each patient is fetched once even with several plans", async () => {
    const api = fakeApi({
      plans: [plan({ id: 1 }), plan({ id: 2 })],
      items: [item({ treatment_plan_id: 1 }), item({ treatment_plan_id: 2 })],
      patients: [patient()],
    });
    await planDentallySync(api, { since: null, now: NOW });
    expect(api.calls.filter((c) => c.startsWith("patient"))).toEqual(["patient 100"]);
  });

  test("falls back to the plan nickname when no item has a price", async () => {
    const api = fakeApi({
      plans: [plan({ nickname: "Smile makeover" })],
      items: [item({ price: "0.0" })],
      patients: [patient()],
    });
    expect((await planDentallySync(api, { since: null, now: NOW })).candidates[0].treatmentType).toBe("Smile makeover");
  });
});
