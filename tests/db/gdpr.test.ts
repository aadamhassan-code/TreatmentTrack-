import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asService, asUser, createTestDb, one, seedPractice, seedTreatment } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});

async function addMember(practiceId: string, role: "staff" | "dentist") {
  const userId = crypto.randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [userId, `${userId}@example.com`]);
  await db.query("insert into practice_members (practice_id, user_id, role) values ($1, $2, $3)", [
    practiceId,
    userId,
    role,
  ]);
  return userId;
}

describe("right to erasure", () => {
  test("an owner can erase a patient: details and treatment go, a suppression marker and bare consent rows stay", async () => {
    const p = await seedPractice(db);
    const t = await seedTreatment(db, p, "+447700911001");
    await asUser(db, p.userId, (tx) =>
      tx.query("update patients set email = 'pat@example.com' where id = $1", [t.patientId])
    );
    await asUser(db, p.userId, (tx) =>
      tx.query(
        `insert into consents (practice_id, patient_id, category, granted, captured_by, notes)
         values ($1, $2, 'cross_sell', true, $3, 'Agreed at hygiene visit')`,
        [p.practiceId, t.patientId, p.userId]
      )
    );

    await asUser(db, p.userId, (tx) => tx.query("select erase_patient($1)", [t.patientId]));

    const patient = await asService(db, (tx) =>
      one<{ full_name: string; phone: string; email: string | null; opted_out_at: string | null; erased_at: string | null }>(
        tx,
        "select full_name, phone, email, opted_out_at, erased_at from patients where id = $1",
        [t.patientId]
      )
    );
    expect(patient.full_name).toBe("Erased patient");
    expect(patient.phone).toMatch(/^erased:[0-9a-f]{64}$/);
    expect(patient.phone).not.toContain("7700911001");
    expect(patient.email).toBeNull();
    expect(patient.opted_out_at).not.toBeNull();
    expect(patient.erased_at).not.toBeNull();

    const counts = await asService(db, (tx) =>
      one<{ treatments: number; steps: number; consents: number; notes: number }>(
        tx,
        `select
           (select count(*)::int from treatments where patient_id = $1) as treatments,
           (select count(*)::int from sequence_steps where treatment_id = $2) as steps,
           (select count(*)::int from consents where patient_id = $1) as consents,
           (select count(*)::int from consents where patient_id = $1 and notes is not null) as notes`,
        [t.patientId, t.treatmentId]
      )
    );
    expect(counts).toEqual({ treatments: 0, steps: 0, consents: 2, notes: 0 });

    const audit = await asUser(db, p.userId, (tx) =>
      one<{ action: string }>(tx, "select action from audit_events where subject_id = $1", [t.patientId])
    );
    expect(audit.action).toBe("patient_erased");
  });

  test("staff can erase, dentists can't, and nobody can erase another practice's patient", async () => {
    const p = await seedPractice(db);
    const other = await seedPractice(db);
    const dentist = await addMember(p.practiceId, "dentist");
    const staff = await addMember(p.practiceId, "staff");
    const t = await seedTreatment(db, p, "+447700911002");

    await expect(asUser(db, dentist, (tx) => tx.query("select erase_patient($1)", [t.patientId]))).rejects.toThrow(
      /only owners and staff/
    );
    await expect(
      asUser(db, other.userId, (tx) => tx.query("select erase_patient($1)", [t.patientId]))
    ).rejects.toThrow(/patient not found/);

    await asUser(db, staff, (tx) => tx.query("select erase_patient($1)", [t.patientId]));
    const row = await asService(db, (tx) =>
      one<{ erased_at: string | null }>(tx, "select erased_at from patients where id = $1", [t.patientId])
    );
    expect(row.erased_at).not.toBeNull();
  });

  test("consent history is still append-only outside erasure", async () => {
    const p = await seedPractice(db);
    const t = await seedTreatment(db, p, "+447700911003");
    await expect(
      asUser(db, p.userId, (tx) => tx.query("update consents set notes = 'x' where id = $1", [t.consentId]))
    ).rejects.toThrow(/append-only/);
    await expect(
      asService(db, (tx) => tx.query("delete from consents where id = $1", [t.consentId]))
    ).rejects.toThrow(/append-only/);
  });

  test("the internal erase function can't be called from the app", async () => {
    const p = await seedPractice(db);
    const t = await seedTreatment(db, p, "+447700911004");
    await expect(
      asUser(db, p.userId, (tx) => tx.query("select erase_patient_internal($1)", [t.patientId]))
    ).rejects.toThrow(/permission denied/);
  });

  test("an erased person who is added again starts opted out, so follow-up can't restart silently", async () => {
    const p = await seedPractice(db);
    const t = await seedTreatment(db, p, "+447700911005");
    await asUser(db, p.userId, (tx) => tx.query("select erase_patient($1)", [t.patientId]));

    const again = await asUser(db, p.userId, (tx) =>
      one<{ id: string; opted_out_at: string | null }>(
        tx,
        "insert into patients (practice_id, full_name, phone) values ($1, 'Returning', '+447700911005') returning id, opted_out_at",
        [p.practiceId]
      )
    );
    expect(again.opted_out_at).not.toBeNull();

    // Same number at a different practice is unaffected.
    const other = await seedPractice(db);
    const elsewhere = await asUser(db, other.userId, (tx) =>
      one<{ opted_out_at: string | null }>(
        tx,
        "insert into patients (practice_id, full_name, phone) values ($1, 'Someone', '+447700911005') returning opted_out_at",
        [other.practiceId]
      )
    );
    expect(elsewhere.opted_out_at).toBeNull();
  });
});

describe("retention", () => {
  test("erases only patients with nothing open who've been inactive past the retention period", async () => {
    const p = await seedPractice(db);
    const closed = await seedTreatment(db, p, "+447700922001");
    const open = await seedTreatment(db, p, "+447700922002");
    await asUser(db, p.userId, (tx) =>
      tx.query("update treatments set status = 'lost' where id = $1", [closed.treatmentId])
    );

    // Not yet: everything is recent.
    const none = await asService(db, (tx) => one<{ n: number }>(tx, "select apply_retention() as n"));
    expect(none.n).toBe(0);

    // 25 months on (default retention is 24): only the closed one goes.
    const later = await asService(db, (tx) =>
      one<{ n: number }>(tx, "select apply_retention(now() + interval '25 months') as n")
    );
    expect(later.n).toBeGreaterThanOrEqual(1);

    const rows = await asService(db, (tx) =>
      tx.query<{ id: string; erased_at: string | null }>(
        "select id, erased_at from patients where id = any($1)",
        [[closed.patientId, open.patientId]]
      )
    );
    const byId = new Map(rows.rows.map((r) => [r.id, r.erased_at]));
    expect(byId.get(closed.patientId)).not.toBeNull();
    expect(byId.get(open.patientId)).toBeNull();
  });

  test("retention can only be run by the server", async () => {
    const p = await seedPractice(db);
    await expect(asUser(db, p.userId, (tx) => tx.query("select apply_retention()"))).rejects.toThrow(
      /permission denied/
    );
  });

  test("the retention period is limited to 6–120 months", async () => {
    const p = await seedPractice(db);
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query("update settings set retention_months = 3 where practice_id = $1", [p.practiceId])
      )
    ).rejects.toThrow(/retention_months/);
  });
});

describe("closing a practice", () => {
  test("purge_practice removes the practice and everything it holds, including consent history", async () => {
    const p = await seedPractice(db);
    const t = await seedTreatment(db, p, "+447700933001");
    await asUser(db, p.userId, (tx) =>
      tx.query("update treatments set status = 'converted' where id = $1", [t.treatmentId])
    );
    await asService(db, (tx) => tx.query("select purge_practice($1)", [p.practiceId]));
    const left = await asService(db, (tx) =>
      one<{ practices: number; consents: number; patients: number }>(
        tx,
        `select (select count(*)::int from practices where id = $1) as practices,
                (select count(*)::int from consents where practice_id = $1) as consents,
                (select count(*)::int from patients where practice_id = $1) as patients`,
        [p.practiceId]
      )
    );
    expect(left).toEqual({ practices: 0, consents: 0, patients: 0 });
  });
});

describe("audit trail", () => {
  test("only the owner can read it, and nobody can write to it directly", async () => {
    const p = await seedPractice(db);
    const staff = await addMember(p.practiceId, "staff");
    const t = await seedTreatment(db, p, "+447700944001");
    await asUser(db, staff, (tx) =>
      tx.query("select record_audit_event('patient_exported', $1, null)", [t.patientId])
    );

    const ownerSees = await asUser(db, p.userId, (tx) =>
      tx.query("select 1 from audit_events where practice_id = $1", [p.practiceId])
    );
    expect(ownerSees.rows.length).toBe(1);
    const staffSees = await asUser(db, staff, (tx) =>
      tx.query("select 1 from audit_events where practice_id = $1", [p.practiceId])
    );
    expect(staffSees.rows.length).toBe(0);

    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query("insert into audit_events (practice_id, action) values ($1, 'patient_erased')", [p.practiceId])
      )
    ).rejects.toThrow(/permission denied/);
  });
});

describe("default wording", () => {
  test("new practices' templates don't name the treatment", async () => {
    const p = await seedPractice(db);
    const rows = await asUser(db, p.userId, (tx) =>
      tx.query<{ body: string }>("select body from message_templates where practice_id = $1", [p.practiceId])
    );
    expect(rows.rows.length).toBe(8);
    for (const r of rows.rows) expect(r.body).not.toContain("{treatmentType}");
    for (const r of rows.rows.filter((x) => x.body.includes("STOP") || x.body.length < 200)) {
      expect(r.body.length).toBeGreaterThan(20);
    }
  });
});

describe("two-factor sign-in is enforced by the database", () => {
  async function asUserWithAal<T>(userId: string, aal: "aal1" | "aal2", fn: (tx: import("@electric-sql/pglite").Transaction) => Promise<T>) {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, aal })]);
      await tx.exec("set local role authenticated");
      return fn(tx);
    });
  }

  test("someone with an authenticator can't see patient data on a password-only session", async () => {
    const p = await seedPractice(db);
    await seedTreatment(db, p, "+447700955001");
    await db.query("insert into auth.mfa_factors (id, user_id, status) values (gen_random_uuid(), $1, 'verified')", [p.userId]);

    const passwordOnly = await asUserWithAal(p.userId, "aal1", (tx) =>
      tx.query("select 1 from patients where practice_id = $1", [p.practiceId])
    );
    expect(passwordOnly.rows.length).toBe(0);

    const withCode = await asUserWithAal(p.userId, "aal2", (tx) =>
      tx.query("select 1 from patients where practice_id = $1", [p.practiceId])
    );
    expect(withCode.rows.length).toBe(1);

    await expect(
      asUserWithAal(p.userId, "aal1", (tx) =>
        tx.query("insert into patients (practice_id, full_name, phone) values ($1, 'X', '+447700955002')", [p.practiceId])
      )
    ).rejects.toThrow(/row-level security/);
  });

  test("users without two-factor work exactly as before", async () => {
    const p = await seedPractice(db);
    await seedTreatment(db, p, "+447700955003");
    const rows = await asUserWithAal(p.userId, "aal1", (tx) =>
      tx.query("select 1 from patients where practice_id = $1", [p.practiceId])
    );
    expect(rows.rows.length).toBe(1);
  });

  test("an unfinished (unverified) set-up doesn't lock anyone out", async () => {
    const p = await seedPractice(db);
    await seedTreatment(db, p, "+447700955004");
    await db.query("insert into auth.mfa_factors (id, user_id, status) values (gen_random_uuid(), $1, 'unverified')", [p.userId]);
    const rows = await asUserWithAal(p.userId, "aal1", (tx) =>
      tx.query("select 1 from patients where practice_id = $1", [p.practiceId])
    );
    expect(rows.rows.length).toBe(1);
  });
});
