import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, one, seedPractice, seedTreatment } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});

describe("each practice only sees its own data (row-level security)", () => {
  test("practice B can't read or change practice A's patients, treatments or consents", async () => {
    const a = await seedPractice(db, "Alpha Dental");
    const b = await seedPractice(db, "Beta Dental");
    const { patientId, treatmentId } = await seedTreatment(db, a, "+447700900100");

    await asUser(db, b.userId, async (tx) => {
      for (const table of ["patients", "treatments", "consents", "sequence_steps", "message_templates", "settings"]) {
        const res = await tx.query<{ practice_id: string }>(`select practice_id from ${table}`);
        expect(res.rows.every((r) => r.practice_id === b.practiceId), table).toBe(true);
      }
      const upd = await tx.query("update treatments set value_pence = 1 where id = $1", [treatmentId]);
      expect(upd.affectedRows).toBe(0);
      const upd2 = await tx.query("update patients set full_name = 'x' where id = $1", [patientId]);
      expect(upd2.affectedRows).toBe(0);
    });
  });

  test("practice B can't insert rows into practice A", async () => {
    const a = await seedPractice(db);
    const b = await seedPractice(db);
    await expect(
      asUser(db, b.userId, (tx) =>
        tx.query("insert into patients (practice_id, full_name, phone) values ($1, 'x', '+447700900101')", [a.practiceId])
      )
    ).rejects.toThrow(/row-level security/);
  });

  test("a practice can't change its own plan, status or billing IDs", async () => {
    const a = await seedPractice(db);
    await asUser(db, a.userId, async (tx) => {
      const res = await tx.query(
        "update practices set status = 'active', plan = 'enterprise' where id = $1",
        [a.practiceId]
      );
      expect(res.affectedRows).toBe(0);
    });
    const row = await one<{ plan: string }>(db, "select plan from practices where id = $1", [a.practiceId]);
    expect(row.plan).toBe("practice");
  });

  test("new practices get default SMS and email templates", async () => {
    const a = await seedPractice(db);
    const res = await db.query<{ channel: string; n: number }>(
      "select channel, count(*)::int as n from message_templates where practice_id = $1 group by channel order by channel",
      [a.practiceId]
    );
    expect(res.rows).toEqual([{ channel: "sms", n: 4 }, { channel: "email", n: 4 }]);
  });

  test("anonymous visitors can submit a callback request but not read any back", async () => {
    await db.transaction(async (tx) => {
      await tx.exec("set local role anon");
      await tx.query("insert into callback_requests (name, email) values ('x', 'x@example.com')");
      const res = await tx.query("select * from callback_requests");
      expect(res.rows).toHaveLength(0);
    });
  });
});
