import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, one, seedPractice } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});

async function addMember(practiceId: string, role: string) {
  const userId = crypto.randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [userId, `${userId}@example.com`]);
  await db.query("insert into practice_members (practice_id, user_id, role) values ($1, $2, $3)", [practiceId, userId, role]);
  return userId;
}

/** A quote for `dentistId`, created by `asUserId`, with one pending message. */
async function quote(practiceId: string, asUserId: string, dentistId: string | null, phone: string) {
  return asUser(db, asUserId, async (tx) => {
    const patient = await one<{ id: string }>(
      tx,
      "insert into patients (practice_id, full_name, phone) values ($1, 'P', $2) returning id",
      [practiceId, phone]
    );
    const consent = await one<{ id: string }>(
      tx,
      `insert into consents (practice_id, patient_id, category, granted, captured_by)
       values ($1, $2, 'quote_followup', true, $3) returning id`,
      [practiceId, patient.id, asUserId]
    );
    const t = await one<{ id: string }>(
      tx,
      `insert into treatments (practice_id, patient_id, treatment_type, value_pence, quote_followup_consent_id, created_by, dentist_user_id)
       values ($1, $2, 'Implant', 100000, $3, $4, $5) returning id`,
      [practiceId, patient.id, consent.id, asUserId, dentistId]
    );
    await tx.query(
      "insert into sequence_steps (treatment_id, practice_id, step, channel, scheduled_for) values ($1, $2, 1, 'sms', now())",
      [t.id, practiceId]
    );
    return t.id;
  });
}

describe("Dentist logins", () => {
  test("see only their own quotes and messages; owners and staff see everyone's", async () => {
    const p = await seedPractice(db);
    const drA = await addMember(p.practiceId, "dentist");
    const drB = await addMember(p.practiceId, "dentist");
    const staff = await addMember(p.practiceId, "staff");
    const mine = await quote(p.practiceId, drA, drA, "+447700901001");
    await quote(p.practiceId, p.userId, drB, "+447700901002");
    await quote(p.practiceId, p.userId, null, "+447700901003");

    const count = (userId: string, table: string) =>
      asUser(db, userId, async (tx) => (await tx.query(`select id from ${table}`)).rows.length);

    expect(await count(drA, "treatments")).toBe(1);
    expect(await count(drA, "sequence_steps")).toBe(1);
    const ids = await asUser(db, drA, async (tx) => (await tx.query<{ id: string }>("select id from treatments")).rows.map((r) => r.id));
    expect(ids).toEqual([mine]);

    expect(await count(p.userId, "treatments")).toBe(3);
    expect(await count(staff, "treatments")).toBe(3);
  });

  test("can't change another dentist's quote, or add a quote in someone else's name", async () => {
    const p = await seedPractice(db);
    const drA = await addMember(p.practiceId, "dentist");
    const drB = await addMember(p.practiceId, "dentist");
    const theirs = await quote(p.practiceId, p.userId, drB, "+447700901011");

    await asUser(db, drA, async (tx) => {
      const upd = await tx.query("update treatments set status = 'lost' where id = $1", [theirs]);
      expect(upd.affectedRows).toBe(0);
    });
    await expect(quote(p.practiceId, drA, drB, "+447700901012")).rejects.toThrow(/row-level security/);
  });

  test("can close their own quote, which cancels its messages as usual", async () => {
    const p = await seedPractice(db);
    const drA = await addMember(p.practiceId, "dentist");
    const mine = await quote(p.practiceId, drA, drA, "+447700901021");
    await asUser(db, drA, (tx) => tx.query("update treatments set status = 'converted' where id = $1", [mine]));
    const step = await one<{ status: string }>(db, "select status from sequence_steps where treatment_id = $1", [mine]);
    expect(step.status).toBe("canceled");
  });

  test("see only Dentally plans assigned to them", async () => {
    const p = await seedPractice(db);
    const drA = await addMember(p.practiceId, "dentist");
    for (const [plan, dentist] of [["1", drA], ["2", null]] as const) {
      await db.query(
        `insert into pms_quote_candidates (practice_id, provider, external_plan_id, external_patient_id, patient_name,
           treatment_type, value_pence, quoted_on, dentist_user_id)
         values ($1, 'dentally', $2, '9', 'x', 'y', 100, '2026-10-01', $3)`,
        [p.practiceId, plan, dentist]
      );
    }
    const plans = await asUser(db, drA, async (tx) =>
      (await tx.query<{ external_plan_id: string }>("select external_plan_id from pms_quote_candidates")).rows.map((r) => r.external_plan_id)
    );
    expect(plans).toEqual(["1"]);
    const all = await asUser(db, p.userId, async (tx) => (await tx.query("select id from pms_quote_candidates")).rows.length);
    expect(all).toBe(2);
  });

  test("still can't change settings, templates or the team", async () => {
    const p = await seedPractice(db);
    const drA = await addMember(p.practiceId, "dentist");
    await asUser(db, drA, async (tx) => {
      expect((await tx.query("update settings set sms_enabled = false")).affectedRows).toBe(0);
      expect((await tx.query("update message_templates set body = 'x'")).affectedRows).toBe(0);
      expect((await tx.query("update practice_members set role = 'owner'")).affectedRows).toBe(0);
    });
  });

  test("only owner, staff and dentist are valid roles", async () => {
    const p = await seedPractice(db);
    await expect(addMember(p.practiceId, "admin")).rejects.toThrow(/check constraint/);
  });
});
