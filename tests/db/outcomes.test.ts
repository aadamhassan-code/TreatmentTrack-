import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, one, seedPractice, seedTreatment } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});

async function pendingSteps(treatmentId: string) {
  const r = await one<{ n: number }>(
    db,
    "select count(*)::int as n from sequence_steps where treatment_id = $1 and status = 'pending'",
    [treatmentId]
  );
  return r.n;
}

describe("closing a quote (Booked / Declined / Lost)", () => {
  test.each([
    ["converted", "converted_at"],
    ["declined", "declined_at"],
    ["lost", "lost_at"],
  ])("marking %s stamps %s and cancels pending messages", async (status, column) => {
    const practice = await seedPractice(db);
    const { treatmentId } = await seedTreatment(db, practice, `+4477009002${Math.floor(Math.random() * 90 + 10)}`);
    expect(await pendingSteps(treatmentId)).toBe(2);

    await asUser(db, practice.userId, (tx) =>
      tx.query(`update treatments set status = $1 where id = $2`, [status, treatmentId])
    );

    expect(await pendingSteps(treatmentId)).toBe(0);
    const row = await one<Record<string, unknown>>(db, `select ${column} as at from treatments where id = $1`, [treatmentId]);
    expect(row.at).not.toBeNull();
    const canceled = await one<{ error: string }>(
      db,
      "select error from sequence_steps where treatment_id = $1 limit 1",
      [treatmentId]
    );
    expect(canceled.error).toBe("Quote closed");
  });

  test("closing a quote doesn't touch messages for the patient's other open quotes", async () => {
    const practice = await seedPractice(db);
    const first = await seedTreatment(db, practice, "+447700900301");
    const second = await seedTreatment(db, practice, "+447700900302");
    await asUser(db, practice.userId, (tx) =>
      tx.query("update treatments set status = 'declined' where id = $1", [first.treatmentId])
    );
    expect(await pendingSteps(second.treatmentId)).toBe(2);
  });

  test("existing rows get a quoted_on date and default to manual entry", async () => {
    const practice = await seedPractice(db);
    const { treatmentId } = await seedTreatment(db, practice, "+447700900303");
    const row = await one<{ quoted_on: Date | string; source: string }>(
      db,
      "select quoted_on, source from treatments where id = $1",
      [treatmentId]
    );
    expect(row.quoted_on).toBeTruthy();
    expect(row.source).toBe("manual");
  });
});

describe("imported quotes", () => {
  test("go through the same consent gate, with the quote date kept", async () => {
    const practice = await seedPractice(db);
    const patientId = crypto.randomUUID();
    const consentId = crypto.randomUUID();
    const treatmentId = crypto.randomUUID();
    await asUser(db, practice.userId, async (tx) => {
      await tx.query(
        "insert into patients (id, practice_id, full_name, phone) values ($1, $2, 'Imported', '+447700900401')",
        [patientId, practice.practiceId]
      );
      await tx.query(
        `insert into consents (id, practice_id, patient_id, category, granted, captured_by, notes)
         values ($1, $2, $3, 'quote_followup', true, $4, 'Imported from CSV')`,
        [consentId, practice.practiceId, patientId, practice.userId]
      );
      await tx.query(
        `insert into treatments (id, practice_id, patient_id, treatment_type, value_pence, quoted_on, source,
                                 quote_followup_consent_id, created_by)
         values ($1, $2, $3, 'Crown', 50000, '2026-06-01', 'csv_import', $4, $5)`,
        [treatmentId, practice.practiceId, patientId, consentId, practice.userId]
      );
    });
    const row = await one<{ quoted_on: Date | string; source: string }>(
      db,
      "select quoted_on, source from treatments where id = $1",
      [treatmentId]
    );
    expect(row.source).toBe("csv_import");
    expect(new Date(row.quoted_on).toISOString().slice(0, 10)).toBe("2026-06-01");
  });

  test("can't be saved without a consent record", async () => {
    const practice = await seedPractice(db);
    await expect(
      asUser(db, practice.userId, async (tx) => {
        const p = await one<{ id: string }>(
          tx,
          "insert into patients (practice_id, full_name, phone) values ($1, 'x', '+447700900402') returning id",
          [practice.practiceId]
        );
        await tx.query(
          `insert into treatments (practice_id, patient_id, treatment_type, value_pence, source,
                                   quote_followup_consent_id, created_by)
           values ($1, $2, 'Crown', 100, 'csv_import', $3, $4)`,
          [practice.practiceId, p.id, crypto.randomUUID(), practice.userId]
        );
      })
    ).rejects.toThrow(/quote_followup consent/);
  });

  test("source must be manual or csv_import", async () => {
    const practice = await seedPractice(db);
    const { treatmentId } = await seedTreatment(db, practice, "+447700900403");
    await expect(
      asUser(db, practice.userId, (tx) =>
        tx.query("update treatments set source = 'anything' where id = $1", [treatmentId])
      )
    ).rejects.toThrow(/check constraint/);
  });
});
