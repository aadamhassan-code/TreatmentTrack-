import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asService, asUser, createTestDb, one, seedPractice, seedTreatment } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});

async function addUser(practiceId: string, role: "owner" | "staff") {
  const userId = crypto.randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [userId, `${userId}@example.com`]);
  await db.query("insert into practice_members (practice_id, user_id, role) values ($1, $2, $3)", [
    practiceId,
    userId,
    role,
  ]);
  return userId;
}

async function setPlan(practiceId: string, plan: string) {
  await db.query("update practices set plan = $1 where id = $2", [plan, practiceId]);
}

async function addLocation(rootId: string, name = "Branch") {
  return asService(db, (tx) =>
    one<{ id: string }>(
      tx,
      `insert into practices (name, slug, plan, status, billing_practice_id)
       select $1, $1 || '-' || gen_random_uuid(), plan, status, id from practices where id = $2
       returning id`,
      [name, rootId]
    )
  );
}

describe("owner and staff roles", () => {
  test("staff can work with patients and quotes", async () => {
    const practice = await seedPractice(db);
    const staffId = await addUser(practice.practiceId, "staff");
    await expect(seedTreatment(db, { practiceId: practice.practiceId, userId: staffId }, "+447700900501")).resolves.toBeTruthy();
  });

  test("staff can read but not change settings or message templates", async () => {
    const practice = await seedPractice(db);
    const staffId = await addUser(practice.practiceId, "staff");
    await asUser(db, staffId, async (tx) => {
      expect((await tx.query("select * from settings")).rows).toHaveLength(1);
      expect((await tx.query("select * from message_templates")).rows.length).toBeGreaterThan(0);
      expect((await tx.query("update settings set sms_enabled = false")).affectedRows).toBe(0);
      expect((await tx.query("update message_templates set body = 'x'")).affectedRows).toBe(0);
      expect((await tx.query("delete from message_templates")).affectedRows).toBe(0);
    });
    await expect(
      asUser(db, staffId, (tx) =>
        tx.query(
          "insert into message_templates (practice_id, step, channel, body) values ($1, 1, 'whatsapp', 'x')",
          [practice.practiceId]
        )
      )
    ).rejects.toThrow(/row-level security/);
  });

  test("owners can change settings and templates", async () => {
    const practice = await seedPractice(db);
    await asUser(db, practice.userId, async (tx) => {
      expect((await tx.query("update settings set sms_enabled = false")).affectedRows).toBe(1);
      expect((await tx.query("update message_templates set body = 'x' where step = 1")).affectedRows).toBe(2);
    });
  });

  test("nobody can add themselves to a practice or promote themselves", async () => {
    const a = await seedPractice(db);
    const b = await seedPractice(db);
    const staffId = await addUser(a.practiceId, "staff");
    await expect(
      asUser(db, staffId, (tx) =>
        tx.query("insert into practice_members (practice_id, user_id, role) values ($1, $2, 'owner')", [
          b.practiceId,
          staffId,
        ])
      )
    ).rejects.toThrow(/row-level security/);
    await asUser(db, staffId, async (tx) => {
      expect((await tx.query("update practice_members set role = 'owner'")).affectedRows).toBe(0);
    });
  });

  test("team members see their own practice's team only", async () => {
    const a = await seedPractice(db);
    const b = await seedPractice(db);
    const staffId = await addUser(a.practiceId, "staff");
    const rows = await asUser(db, staffId, (tx) => tx.query<{ practice_id: string }>("select practice_id from practice_members"));
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.every((r) => r.practice_id === a.practiceId)).toBe(true);
    void b;
  });
});

describe("people in more than one practice", () => {
  test("see only the practice they've switched to, and can only switch to their own", async () => {
    const a = await seedPractice(db, "Switch A");
    const b = await seedPractice(db, "Switch B");
    const c = await seedPractice(db, "Switch C");
    await db.query("insert into practice_members (practice_id, user_id, role) values ($1, $2, 'staff')", [
      b.practiceId,
      a.userId,
    ]);
    await seedTreatment(db, a, "+447700900601");
    await seedTreatment(db, b, "+447700900602");

    const phones = () =>
      asUser(db, a.userId, async (tx) => (await tx.query<{ phone: string }>("select phone from patients")).rows.map((r) => r.phone));

    expect(await phones()).toEqual(["+447700900601"]);

    await asUser(db, a.userId, (tx) =>
      tx.query("insert into user_active_practice (user_id, practice_id) values ($1, $2)", [a.userId, b.practiceId])
    );
    expect(await phones()).toEqual(["+447700900602"]);

    // Role follows the practice: owner in A, staff in B.
    const role = await asUser(db, a.userId, (tx) => one<{ role: string }>(tx, "select current_practice_role() as role"));
    expect(role.role).toBe("staff");

    // The switcher can list both, but never a practice they don't belong to.
    const listed = await asUser(db, a.userId, (tx) => tx.query<{ name: string }>("select name from practices order by name"));
    expect(listed.rows.map((r) => r.name)).toEqual(["Switch A", "Switch B"]);

    await expect(
      asUser(db, a.userId, (tx) =>
        tx.query("update user_active_practice set practice_id = $1 where user_id = $2", [c.practiceId, a.userId])
      )
    ).rejects.toThrow(/row-level security/);
  });

  test("being removed from the practice you switched to falls back to your first practice", async () => {
    const a = await seedPractice(db);
    const b = await seedPractice(db);
    await db.query("insert into practice_members (practice_id, user_id, role) values ($1, $2, 'staff')", [
      b.practiceId,
      a.userId,
    ]);
    await db.query("insert into user_active_practice (user_id, practice_id) values ($1, $2)", [a.userId, b.practiceId]);
    await db.query("delete from practice_members where practice_id = $1 and user_id = $2", [b.practiceId, a.userId]);
    const current = await asUser(db, a.userId, (tx) => one<{ id: string }>(tx, "select current_practice_id() as id"));
    expect(current.id).toBe(a.practiceId);
  });
});

describe("Multisite locations", () => {
  test("Multisite allows 5 locations in total", async () => {
    const root = await seedPractice(db);
    await setPlan(root.practiceId, "multisite");
    for (let i = 0; i < 4; i++) await addLocation(root.practiceId, `Branch ${i}`);
    await expect(addLocation(root.practiceId)).rejects.toThrow(/allows 5 location/);
  });

  test.each(["solo", "practice"])("%s plan can't add locations", async (plan) => {
    const root = await seedPractice(db);
    await setPlan(root.practiceId, plan);
    await expect(addLocation(root.practiceId)).rejects.toThrow(/allows 1 location/);
  });

  test("Enterprise has no limit", async () => {
    const root = await seedPractice(db);
    await setPlan(root.practiceId, "enterprise");
    for (let i = 0; i < 6; i++) await addLocation(root.practiceId, `E${i}`);
  });

  test("a location can't have locations of its own", async () => {
    const root = await seedPractice(db);
    await setPlan(root.practiceId, "multisite");
    const branch = await addLocation(root.practiceId);
    await expect(addLocation(branch.id)).rejects.toThrow(/billed under the practice that holds/);
  });

  test("cancelling the subscription stops every location", async () => {
    const root = await seedPractice(db);
    await setPlan(root.practiceId, "multisite");
    const branch = await addLocation(root.practiceId);
    await db.query("update practices set status = 'canceled' where id = $1", [root.practiceId]);
    const row = await one<{ status: string }>(db, "select status from practices where id = $1", [branch.id]);
    expect(row.status).toBe("canceled");
  });

  test("each location's patients stay separate, and new locations get default templates", async () => {
    const root = await seedPractice(db);
    await setPlan(root.practiceId, "multisite");
    const branch = await addLocation(root.practiceId);
    await db.query("insert into practice_members (practice_id, user_id, role) values ($1, $2, 'owner')", [
      branch.id,
      root.userId,
    ]);
    await seedTreatment(db, root, "+447700900701");
    const visible = await asUser(db, root.userId, async (tx) => {
      await tx.query("insert into user_active_practice (user_id, practice_id) values ($1, $2)", [root.userId, branch.id]);
      return (await tx.query("select id from patients")).rows.length;
    });
    expect(visible).toBe(0);
    const templates = await one<{ n: number }>(db, "select count(*)::int as n from message_templates where practice_id = $1", [branch.id]);
    expect(templates.n).toBe(8);
  });
});
