import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asService, asUser, createTestDb, one, seedPractice, seedTreatment } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});

describe("quote follow-up consent (PECR soft opt-in)", () => {
  test("a treatment can't be created without a consent row", async () => {
    const p = await seedPractice(db);
    await expect(
      asUser(db, p.userId, async (tx) => {
        const patient = await one<{ id: string }>(
          tx,
          "insert into patients (practice_id, full_name, phone) values ($1, 'A', '+447700900001') returning id",
          [p.practiceId]
        );
        await tx.query(
          `insert into treatments (practice_id, patient_id, treatment_type, value_pence,
                                   quote_followup_consent_id, created_by)
           values ($1, $2, 'Crown', 1000, gen_random_uuid(), $3)`,
          [p.practiceId, patient.id, p.userId]
        );
      })
    ).rejects.toThrow(/requires a granted quote_followup consent/);
  });

  test("a refused (granted=false) consent doesn't count", async () => {
    const p = await seedPractice(db);
    await expect(
      asUser(db, p.userId, async (tx) => {
        const patient = await one<{ id: string }>(
          tx,
          "insert into patients (practice_id, full_name, phone) values ($1, 'A', '+447700900002') returning id",
          [p.practiceId]
        );
        const c = await one<{ id: string }>(
          tx,
          `insert into consents (practice_id, patient_id, category, granted, captured_by)
           values ($1, $2, 'quote_followup', false, $3) returning id`,
          [p.practiceId, patient.id, p.userId]
        );
        await tx.query(
          `insert into treatments (practice_id, patient_id, treatment_type, value_pence,
                                   quote_followup_consent_id, created_by)
           values ($1, $2, 'Crown', 1000, $3, $4)`,
          [p.practiceId, patient.id, c.id, p.userId]
        );
      })
    ).rejects.toThrow(/requires a granted quote_followup consent/);
  });

  test("cross-sell consent can't stand in for quote follow-up consent", async () => {
    const p = await seedPractice(db);
    await expect(
      asUser(db, p.userId, async (tx) => {
        const patient = await one<{ id: string }>(
          tx,
          "insert into patients (practice_id, full_name, phone) values ($1, 'A', '+447700900003') returning id",
          [p.practiceId]
        );
        const c = await one<{ id: string }>(
          tx,
          `insert into consents (practice_id, patient_id, category, granted, captured_by)
           values ($1, $2, 'cross_sell', true, $3) returning id`,
          [p.practiceId, patient.id, p.userId]
        );
        await tx.query(
          `insert into treatments (practice_id, patient_id, treatment_type, value_pence,
                                   quote_followup_consent_id, created_by)
           values ($1, $2, 'Crown', 1000, $3, $4)`,
          [p.practiceId, patient.id, c.id, p.userId]
        );
      })
    ).rejects.toThrow(/requires a granted quote_followup consent/);
  });

  test("a granted consent for this patient allows the treatment", async () => {
    const p = await seedPractice(db);
    const { treatmentId } = await seedTreatment(db, p, "+447700900004");
    expect(treatmentId).toBeTruthy();
  });

  test("consent history is append-only", async () => {
    const p = await seedPractice(db);
    const { consentId } = await seedTreatment(db, p, "+447700900005");
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query("update consents set granted = false where id = $1", [consentId])
      )
    ).rejects.toThrow(/append-only/);
    await expect(
      asUser(db, p.userId, (tx) => tx.query("delete from consents where id = $1", [consentId]))
    ).rejects.toThrow(/append-only/);
  });

  test("a staff-recorded consent must say which staff member recorded it", async () => {
    const p = await seedPractice(db);
    const { patientId } = await seedTreatment(db, p, "+447700900006");
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query(
          `insert into consents (practice_id, patient_id, category, granted, source)
           values ($1, $2, 'cross_sell', true, 'staff')`,
          [p.practiceId, patientId]
        )
      )
    ).rejects.toThrow(/check constraint/);
  });
});

describe("cross-sell consent", () => {
  test("a visit can't be marked as a sent suggestion without cross-sell consent", async () => {
    const p = await seedPractice(db);
    const { patientId } = await seedTreatment(db, p, "+447700900010");
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query(
          `insert into visits (practice_id, patient_id, visit_type, suggested_treatment_type,
                               suggestion_sent, created_by)
           values ($1, $2, 'hygiene', 'Whitening', true, $3)`,
          [p.practiceId, patientId, p.userId]
        )
      )
    ).rejects.toThrow(/requires cross_sell consent/);
  });

  test("the latest cross-sell consent wins — a later withdrawal blocks it", async () => {
    const p = await seedPractice(db);
    const { patientId } = await seedTreatment(db, p, "+447700900011");
    await asUser(db, p.userId, async (tx) => {
      await tx.query(
        `insert into consents (practice_id, patient_id, category, granted, captured_by, captured_at)
         values ($1, $2, 'cross_sell', true, $3, now() - interval '1 day'),
                ($1, $2, 'cross_sell', false, $3, now())`,
        [p.practiceId, patientId, p.userId]
      );
    });
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query(
          `insert into visits (practice_id, patient_id, visit_type, suggested_treatment_type,
                               suggestion_sent, created_by)
           values ($1, $2, 'hygiene', 'Whitening', true, $3)`,
          [p.practiceId, patientId, p.userId]
        )
      )
    ).rejects.toThrow(/requires cross_sell consent/);
  });

  test("with cross-sell consent the suggestion is allowed", async () => {
    const p = await seedPractice(db);
    const { patientId } = await seedTreatment(db, p, "+447700900012");
    await asUser(db, p.userId, async (tx) => {
      await tx.query(
        `insert into consents (practice_id, patient_id, category, granted, captured_by)
         values ($1, $2, 'cross_sell', true, $3)`,
        [p.practiceId, patientId, p.userId]
      );
      await tx.query(
        `insert into visits (practice_id, patient_id, visit_type, suggested_treatment_type,
                             suggestion_sent, created_by)
         values ($1, $2, 'hygiene', 'Whitening', true, $3)`,
        [p.practiceId, patientId, p.userId]
      );
    });
  });
});

describe("STOP / opt-out", () => {
  const optOut = (phone: string) =>
    asService(db, (tx) =>
      one<{ n: number }>(tx, "select record_patient_opt_out($1) as n", [phone])
    );

  test("STOP opts the patient out, records a withdrawal and cancels pending messages", async () => {
    const p = await seedPractice(db);
    const { patientId, treatmentId } = await seedTreatment(db, p, "+447700900020");

    expect((await optOut("+447700900020")).n).toBe(1);

    const patient = await one<{ opted_out_at: string | null }>(
      db, "select opted_out_at from patients where id = $1", [patientId]
    );
    expect(patient.opted_out_at).not.toBeNull();

    const withdrawals = await db.query<{ category: string; source: string }>(
      "select category, source from consents where patient_id = $1 and granted = false order by category",
      [patientId]
    );
    expect(withdrawals.rows).toEqual([
      { category: "quote_followup", source: "patient_reply" },
      { category: "cross_sell", source: "patient_reply" },
    ]);

    const steps = await db.query<{ status: string }>(
      "select status from sequence_steps where treatment_id = $1", [treatmentId]
    );
    expect(steps.rows.map((r) => r.status)).toEqual(["canceled", "canceled"]);
  });

  test("STOP doesn't touch other patients", async () => {
    const p = await seedPractice(db);
    const { treatmentId } = await seedTreatment(db, p, "+447700900021");
    await optOut("+447700900099");
    const steps = await db.query<{ status: string }>(
      "select status from sequence_steps where treatment_id = $1", [treatmentId]
    );
    expect(steps.rows.every((r) => r.status === "pending")).toBe(true);
  });

  test("a logged-in practice user can't call the opt-out function directly", async () => {
    const p = await seedPractice(db);
    await expect(
      asUser(db, p.userId, (tx) => tx.query("select record_patient_opt_out('+447700900022')"))
    ).rejects.toThrow(/permission denied/);
  });

  test("an opted-out patient can't be given a new treatment", async () => {
    const p = await seedPractice(db);
    const { patientId } = await seedTreatment(db, p, "+447700900023");
    await optOut("+447700900023");
    await expect(
      asUser(db, p.userId, async (tx) => {
        const c = await one<{ id: string }>(
          tx,
          `insert into consents (practice_id, patient_id, category, granted, captured_by)
           values ($1, $2, 'quote_followup', true, $3) returning id`,
          [p.practiceId, patientId, p.userId]
        );
        await tx.query(
          `insert into treatments (practice_id, patient_id, treatment_type, value_pence,
                                   quote_followup_consent_id, created_by)
           values ($1, $2, 'Implant', 250000, $3, $4)`,
          [p.practiceId, patientId, c.id, p.userId]
        );
      })
    ).rejects.toThrow(/opted out/);
  });

  test("an opt-out can't be cleared without fresh consent recorded after it", async () => {
    const p = await seedPractice(db);
    const { patientId } = await seedTreatment(db, p, "+447700900024");
    await optOut("+447700900024");
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query("update patients set opted_out_at = null where id = $1", [patientId])
      )
    ).rejects.toThrow(/without a new quote_followup consent/);
  });

  test("with fresh consent the opt-out can be cleared and a new treatment added", async () => {
    const p = await seedPractice(db);
    const { patientId } = await seedTreatment(db, p, "+447700900025");
    await optOut("+447700900025");
    await asUser(db, p.userId, async (tx) => {
      const c = await one<{ id: string }>(
        tx,
        `insert into consents (practice_id, patient_id, category, granted, captured_by, notes)
         values ($1, $2, 'quote_followup', true, $3, 'Patient asked to hear from us again') returning id`,
        [p.practiceId, patientId, p.userId]
      );
      await tx.query("update patients set opted_out_at = null where id = $1", [patientId]);
      await tx.query(
        `insert into treatments (practice_id, patient_id, treatment_type, value_pence,
                                 quote_followup_consent_id, created_by)
         values ($1, $2, 'Implant', 250000, $3, $4)`,
        [p.practiceId, patientId, c.id, p.userId]
      );
    });
  });
});
