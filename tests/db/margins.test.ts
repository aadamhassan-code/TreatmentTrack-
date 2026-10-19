import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, seedPractice } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});

async function addDentist(practiceId: string) {
  const userId = crypto.randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [userId, `${userId}@example.com`]);
  await db.query("insert into practice_members (practice_id, user_id, role) values ($1, $2, 'dentist')", [practiceId, userId]);
  return userId;
}

describe("dentist pay shares", () => {
  test("owners set them; a dentist sees only their own; other practices see nothing", async () => {
    const p = await seedPractice(db);
    const drA = await addDentist(p.practiceId);
    const drB = await addDentist(p.practiceId);
    await asUser(db, p.userId, (tx) =>
      tx.query("insert into dentist_pay_rates (practice_id, user_id, share_pct) values ($1, $2, 50), ($1, $3, 45)", [
        p.practiceId,
        drA,
        drB,
      ])
    );

    const ownerSees = await asUser(db, p.userId, (tx) => tx.query("select user_id from dentist_pay_rates"));
    expect(ownerSees.rows.length).toBe(2);

    const aSees = await asUser(db, drA, (tx) => tx.query<{ user_id: string }>("select user_id from dentist_pay_rates"));
    expect(aSees.rows.map((r) => r.user_id)).toEqual([drA]);

    await expect(
      asUser(db, drA, (tx) => tx.query("update dentist_pay_rates set share_pct = 90 where user_id = $1", [drA]))
    ).resolves.toMatchObject({ affectedRows: 0 });

    const other = await seedPractice(db);
    const otherSees = await asUser(db, other.userId, (tx) => tx.query("select 1 from dentist_pay_rates"));
    expect(otherSees.rows.length).toBe(0);
  });

  test("shares must be 0–100%", async () => {
    const p = await seedPractice(db);
    const dr = await addDentist(p.practiceId);
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query("insert into dentist_pay_rates (practice_id, user_id, share_pct) values ($1, $2, 120)", [p.practiceId, dr])
      )
    ).rejects.toThrow(/check/);
  });
});
