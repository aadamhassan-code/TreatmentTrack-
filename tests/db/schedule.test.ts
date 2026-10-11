import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createTestDb, one, seedPractice, seedTreatment } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});

describe("practice follow-up schedule", () => {
  test("defaults to 3, 7, 14 and 30 days, with wording for messages 1–4", async () => {
    const p = await seedPractice(db);
    const s = await one<{ sequence_days: number[] }>(db, "select sequence_days from settings where practice_id = $1", [p.practiceId]);
    expect(s.sequence_days).toEqual([3, 7, 14, 30]);
    const steps = await db.query<{ step: number }>(
      "select distinct step from message_templates where practice_id = $1 order by step",
      [p.practiceId]
    );
    expect(steps.rows.map((r) => r.step)).toEqual([1, 2, 3, 4]);
  });

  test.each([
    ["{3,7,30}", true],
    ["{1}", true],
    ["{3,7,14,30,60,90}", true],
    ["{}", false],
    ["{3,7,14,30,60,90,120}", false],
    ["{7,3}", false],
    ["{3,3}", false],
    ["{0,7}", false],
    ["{3,400}", false],
  ])("schedule %s valid: %s", async (days, ok) => {
    const p = await seedPractice(db);
    const run = asUser(db, p.userId, (tx) => tx.query(`update settings set sequence_days = $1::smallint[]`, [days]));
    if (ok) await expect(run).resolves.toBeTruthy();
    else await expect(run).rejects.toThrow(/settings_sequence_days_valid/);
  });

  test("templates exist for messages 1–6 only", async () => {
    const p = await seedPractice(db);
    await asUser(db, p.userId, (tx) =>
      tx.query("insert into message_templates (practice_id, step, channel, body) values ($1, 6, 'sms', 'x')", [p.practiceId])
    );
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query("insert into message_templates (practice_id, step, channel, body) values ($1, 7, 'sms', 'x')", [p.practiceId])
      )
    ).rejects.toThrow(/message_templates_step_range/);
  });
});

describe("pausing and restarting a quote's messages", () => {
  test("the same message can be scheduled again once the earlier one isn't pending", async () => {
    const p = await seedPractice(db);
    const { treatmentId } = await seedTreatment(db, p, "+447700901101");
    await asUser(db, p.userId, async (tx) => {
      await tx.query("update sequence_steps set status = 'canceled', error = 'Paused' where treatment_id = $1", [treatmentId]);
      await tx.query(
        "insert into sequence_steps (treatment_id, practice_id, step, channel, scheduled_for) values ($1, $2, 1, 'sms', now() + interval '60 days')",
        [treatmentId, p.practiceId]
      );
    });
    const n = await one<{ n: number }>(db, "select count(*)::int as n from sequence_steps where treatment_id = $1 and step = 1", [treatmentId]);
    expect(n.n).toBe(2);
  });

  test("but never two of the same message waiting to send", async () => {
    const p = await seedPractice(db);
    const { treatmentId } = await seedTreatment(db, p, "+447700901102");
    await expect(
      asUser(db, p.userId, (tx) =>
        tx.query(
          "insert into sequence_steps (treatment_id, practice_id, step, channel, scheduled_for) values ($1, $2, 1, 'sms', now())",
          [treatmentId, p.practiceId]
        )
      )
    ).rejects.toThrow(/sequence_steps_one_pending_per_step/);
  });
});
