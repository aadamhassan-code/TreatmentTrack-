import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, one, seedPractice } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});

async function connect(practiceId: string) {
  await db.query(
    "insert into integrations (practice_id, provider, encrypted_api_key, account_label) values ($1, 'dentally', 'v1:secret', 'Dr Test')",
    [practiceId]
  );
}

async function addCandidate(practiceId: string, planId = "77") {
  return one<{ id: string }>(
    db,
    `insert into pms_quote_candidates (practice_id, provider, external_plan_id, external_patient_id, patient_name,
       phone, treatment_type, value_pence, quoted_on)
     values ($1, 'dentally', $2, '100', 'Priya Shah', '+447700900201', 'Implant', 240000, '2026-10-01') returning id`,
    [practiceId, planId]
  );
}

describe("Dentally connection", () => {
  test("signed-in users can see that it's connected but can never read the stored API key", async () => {
    const p = await seedPractice(db);
    await connect(p.practiceId);
    const row = await asUser(db, p.userId, (tx) =>
      one<{ account_label: string }>(tx, "select account_label from integrations")
    );
    expect(row.account_label).toBe("Dr Test");
    await expect(
      asUser(db, p.userId, (tx) => tx.query("select encrypted_api_key from integrations"))
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(db, p.userId, (tx) => tx.query("select * from integrations"))).rejects.toThrow(
      /permission denied/
    );
  });

  test("users can't connect, change or delete integrations directly — only owner-checked server code can", async () => {
    const p = await seedPractice(db);
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query("insert into integrations (practice_id, provider, encrypted_api_key) values ($1, 'dentally', 'x')", [
          p.practiceId,
        ])
      )
    ).rejects.toThrow(/permission denied/);
  });

  test("another practice can't see the connection or its review list", async () => {
    const a = await seedPractice(db);
    const b = await seedPractice(db);
    await connect(a.practiceId);
    const candidate = await addCandidate(a.practiceId);
    await asUser(db, b.userId, async (tx) => {
      expect((await tx.query("select id from integrations")).rows).toHaveLength(0);
      expect((await tx.query("select id from pms_quote_candidates")).rows).toHaveLength(0);
      const upd = await tx.query("update pms_quote_candidates set status = 'dismissed' where id = $1", [candidate.id]);
      expect(upd.affectedRows).toBe(0);
    });
  });

  test("staff in the practice can review: mark candidates started or dismissed, but not add them", async () => {
    const p = await seedPractice(db);
    const candidate = await addCandidate(p.practiceId, "88");
    await asUser(db, p.userId, async (tx) => {
      const upd = await tx.query("update pms_quote_candidates set status = 'dismissed' where id = $1", [candidate.id]);
      expect(upd.affectedRows).toBe(1);
    });
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query(
          `insert into pms_quote_candidates (practice_id, provider, external_plan_id, external_patient_id, patient_name,
             treatment_type, value_pence, quoted_on) values ($1, 'dentally', '99', '1', 'x', 'y', 1, '2026-10-01')`,
          [p.practiceId]
        )
      )
    ).rejects.toThrow(/row-level security/);
  });

  test("quotes started from Dentally still need a consent record, and keep the Dentally plan id", async () => {
    const p = await seedPractice(db);
    await expect(
      asUser(db, p.userId, async (tx) => {
        const patient = await one<{ id: string }>(
          tx,
          "insert into patients (practice_id, full_name, phone) values ($1, 'Priya', '+447700900201') returning id",
          [p.practiceId]
        );
        await tx.query(
          `insert into treatments (practice_id, patient_id, treatment_type, value_pence, source, external_id,
             quote_followup_consent_id, created_by) values ($1, $2, 'Implant', 1, 'dentally', '77', gen_random_uuid(), $3)`,
          [p.practiceId, patient.id, p.userId]
        );
      })
    ).rejects.toThrow(/quote_followup consent/);
  });
});
