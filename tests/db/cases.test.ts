import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, one, seedPractice } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});

async function addMember(practiceId: string, role: string, displayName: string | null = null) {
  const userId = crypto.randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [userId, `${userId}@example.com`]);
  await db.query("insert into practice_members (practice_id, user_id, role, display_name) values ($1, $2, $3, $4)", [
    practiceId,
    userId,
    role,
    displayName,
  ]);
  return userId;
}

let phoneCounter = 0;
async function quote(practiceId: string, asUserId: string, treatmentType: string, dentistId: string | null = null) {
  const phone = `+4477009020${String(++phoneCounter).padStart(2, "0")}`;
  return asUser(db, asUserId, async (tx) => {
    const patient = await one<{ id: string }>(
      tx,
      "insert into patients (practice_id, full_name, phone) values ($1, 'Jane Doe', $2) returning id",
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
       values ($1, $2, $3, 250000, $4, $5, $6) returning id`,
      [practiceId, patient.id, treatmentType, consent.id, asUserId, dentistId]
    );
    return t.id;
  });
}

const caseFor = (treatmentId: string) =>
  db.query<{ id: string; status: string; board: string; stage: string; patient_name: string; value_pence: number }>(
    `select c.id, c.status, b.name as board, s.name as stage, c.patient_name, c.value_pence
     from cases c left join case_boards b on b.id = c.board_id left join case_stages s on s.id = c.stage_id
     where c.treatment_id = $1`,
    [treatmentId]
  );

describe("starting boards", () => {
  test("every practice gets the five starting boards and their stages", async () => {
    const p = await seedPractice(db);
    const boards = await db.query<{ name: string; stages: string[] }>(
      `select b.name, array_agg(s.name order by s.position) as stages
       from case_boards b join case_stages s on s.board_id = b.id
       where b.practice_id = $1 group by b.name, b.position order by b.position`,
      [p.practiceId]
    );
    expect(boards.rows.map((b) => b.name)).toEqual([
      "Implants",
      "Aligners & ortho",
      "Crowns, bridges & veneers",
      "Whitening",
      "Other treatment",
    ]);
    expect(boards.rows[0].stages).toEqual([
      "Consultation",
      "Consent signed",
      "Implant placed",
      "Healing",
      "Scan done",
      "Crown fitted",
    ]);
  });
});

describe("booking a quote", () => {
  test.each([
    ["Implant UR6", "Implants"],
    ["Invisalign", "Aligners & ortho"],
    ["Crown LL7", "Crowns, bridges & veneers"],
    ["Home whitening", "Whitening"],
    ["Root canal", "Other treatment"],
  ])("%s goes on the %s board at its first stage", async (type, board) => {
    const p = await seedPractice(db);
    const t = await quote(p.practiceId, p.userId, type);
    expect((await caseFor(t)).rows).toEqual([]);
    await asUser(db, p.userId, (tx) => tx.query("update treatments set status = 'converted' where id = $1", [t]));
    const [c] = (await caseFor(t)).rows;
    expect(c).toMatchObject({ status: "active", board, patient_name: "Jane Doe", value_pence: 250000 });
    expect(c.stage).toBeTruthy();
  });

  test("an implant crown goes on the Implants board, not Crowns", async () => {
    const p = await seedPractice(db);
    const t = await quote(p.practiceId, p.userId, "Implant crown");
    await asUser(db, p.userId, (tx) => tx.query("update treatments set status = 'converted' where id = $1", [t]));
    expect((await caseFor(t)).rows[0].board).toBe("Implants");
  });

  test("reopening the quote takes it off the board; booking again puts the same case back", async () => {
    const p = await seedPractice(db);
    const t = await quote(p.practiceId, p.userId, "Implant");
    const book = (status: string) =>
      asUser(db, p.userId, (tx) => tx.query("update treatments set status = $2 where id = $1", [t, status]));
    await book("converted");
    const first = (await caseFor(t)).rows[0];
    await book("in_sequence");
    expect((await caseFor(t)).rows[0].status).toBe("stopped");
    await book("converted");
    const again = (await caseFor(t)).rows;
    expect(again).toHaveLength(1);
    expect(again[0]).toMatchObject({ id: first.id, status: "active" });
  });

  test("not added automatically when the practice turns that off", async () => {
    const p = await seedPractice(db);
    await asUser(db, p.userId, (tx) => tx.query("update settings set cases_auto_start = false"));
    const t = await quote(p.practiceId, p.userId, "Implant");
    await asUser(db, p.userId, (tx) => tx.query("update treatments set status = 'converted' where id = $1", [t]));
    expect((await caseFor(t)).rows).toEqual([]);
  });
});

describe("moving a case", () => {
  test("records who moved it and when; completing stamps the date", async () => {
    const p = await seedPractice(db);
    const staff = await addMember(p.practiceId, "staff", "Sam (TCO)");
    const t = await quote(p.practiceId, p.userId, "Implant");
    await asUser(db, p.userId, (tx) => tx.query("update treatments set status = 'converted' where id = $1", [t]));
    const c = (await caseFor(t)).rows[0];

    await asUser(db, staff, (tx) =>
      tx.query(
        `update cases set stage_id = (select id from case_stages where board_id = cases.board_id and name = 'Consent signed')
         where id = $1`,
        [c.id]
      )
    );
    await asUser(db, staff, (tx) => tx.query("update cases set status = 'completed' where id = $1", [c.id]));

    const events = await asUser(db, p.userId, (tx) =>
      tx.query<{ kind: string; stage_name: string | null; by_name: string | null }>(
        "select kind, stage_name, by_name from case_events where case_id = $1 order by created_at, kind desc",
        [c.id]
      )
    );
    expect(events.rows.map((e) => [e.kind, e.stage_name])).toEqual([
      ["started", "Consultation"],
      ["moved", "Consent signed"],
      ["completed", null],
    ]);
    expect(events.rows[1].by_name).toBe("Sam (TCO)");
    const done = await one<{ completed_at: string | null }>(db, "select completed_at from cases where id = $1", [c.id]);
    expect(done.completed_at).not.toBeNull();
  });

  test("a case can't be put on a stage from another board", async () => {
    const p = await seedPractice(db);
    const t = await quote(p.practiceId, p.userId, "Implant");
    await asUser(db, p.userId, (tx) => tx.query("update treatments set status = 'converted' where id = $1", [t]));
    const c = (await caseFor(t)).rows[0];
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query(
          `update cases set stage_id = (select s.id from case_stages s join case_boards b on b.id = s.board_id
                                         where b.name = 'Whitening' and b.practice_id = $2 limit 1)
           where id = $1`,
          [c.id, p.practiceId]
        )
      )
    ).rejects.toThrow(/stage must belong/);
  });

  test("history can't be written or edited by hand", async () => {
    const p = await seedPractice(db);
    const t = await quote(p.practiceId, p.userId, "Implant");
    await asUser(db, p.userId, (tx) => tx.query("update treatments set status = 'converted' where id = $1", [t]));
    const c = (await caseFor(t)).rows[0];
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query("insert into case_events (case_id, practice_id, kind) values ($1, $2, 'moved')", [c.id, p.practiceId])
      )
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(db, p.userId, (tx) => tx.query("update case_events set by_name = 'x'"))).rejects.toThrow(
      /permission denied/
    );
    await expect(asUser(db, p.userId, (tx) => tx.query("delete from cases where id = $1", [c.id]))).rejects.toThrow(
      /permission denied/
    );
  });

  test("a stage with active cases can't be deleted", async () => {
    const p = await seedPractice(db);
    const t = await quote(p.practiceId, p.userId, "Implant");
    await asUser(db, p.userId, (tx) => tx.query("update treatments set status = 'converted' where id = $1", [t]));
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query(
          "delete from case_stages where id = (select stage_id from cases where treatment_id = $1)",
          [t]
        )
      )
    ).rejects.toThrow(/still has active cases/);
  });
});

describe("who can see and change what", () => {
  test("a dentist sees only their own cases; staff can't change the stages", async () => {
    const p = await seedPractice(db);
    const drA = await addMember(p.practiceId, "dentist");
    const drB = await addMember(p.practiceId, "dentist");
    const staff = await addMember(p.practiceId, "staff");
    const mine = await quote(p.practiceId, p.userId, "Implant", drA);
    const theirs = await quote(p.practiceId, p.userId, "Implant", drB);
    for (const t of [mine, theirs]) {
      await asUser(db, p.userId, (tx) => tx.query("update treatments set status = 'converted' where id = $1", [t]));
    }

    const visible = await asUser(db, drA, async (tx) =>
      (await tx.query<{ treatment_id: string }>("select treatment_id from cases")).rows.map((r) => r.treatment_id)
    );
    expect(visible).toEqual([mine]);
    const events = await asUser(db, drA, async (tx) => (await tx.query("select id from case_events")).rows.length);
    expect(events).toBe(1);

    // Staff (and dentists) can read the boards but not change them.
    const renamed = await asUser(db, staff, async (tx) => {
      const r = await tx.query("update case_stages set name = 'x'");
      return r.affectedRows;
    });
    expect(renamed).toBe(0);
    const boards = await asUser(db, drA, async (tx) => (await tx.query("select id from case_boards")).rows.length);
    expect(boards).toBe(5);
  });

  test("other practices' cases and boards are invisible", async () => {
    const a = await seedPractice(db);
    const b = await seedPractice(db);
    const t = await quote(a.practiceId, a.userId, "Implant");
    await asUser(db, a.userId, (tx) => tx.query("update treatments set status = 'converted' where id = $1", [t]));
    const seen = await asUser(db, b.userId, async (tx) => ({
      cases: (await tx.query("select id from cases")).rows.length,
      boards: (await tx.query("select id from case_boards where practice_id = $1", [a.practiceId])).rows.length,
    }));
    expect(seen).toEqual({ cases: 0, boards: 0 });
  });

  test("a hand-added case can't point at another practice's board", async () => {
    const a = await seedPractice(db);
    const b = await seedPractice(db);
    const otherBoard = await one<{ id: string }>(db, "select id from case_boards where practice_id = $1 limit 1", [
      b.practiceId,
    ]);
    await expect(
      asUser(db, a.userId, (tx) =>
        tx.query(
          "insert into cases (practice_id, board_id, patient_name, treatment_type) values ($1, $2, 'X', 'Implant')",
          [a.practiceId, otherBoard.id]
        )
      )
    ).rejects.toThrow(/board must belong/);
  });
});
