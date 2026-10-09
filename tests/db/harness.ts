import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

/**
 * Spins up an in-memory Postgres (PGlite — real Postgres compiled to
 * WebAssembly) with the small slice of Supabase our migration relies on:
 * the anon/authenticated/service_role roles, an auth.users table, and
 * auth.uid() reading the signed-in user from the request's JWT claims.
 * Then it runs the real migration file, so these tests exercise the exact
 * triggers and row-level security policies that run in production.
 */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

const GRANTS = `
  grant usage on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
`;

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const migrationsDir = join(__dirname, "../../supabase/migrations");
  const migration = readFileSync(join(migrationsDir, "0001_init.sql"), "utf8")
    // gen_random_uuid() is built into Postgres 13+; PGlite doesn't ship pgcrypto.
    .replace(/create extension if not exists pgcrypto;/i, "");
  await db.exec(migration);
  await db.exec(GRANTS);
  return db;
}

type Tx = Transaction;

/** Runs `fn` as a signed-in staff user, with row-level security applied. */
export async function asUser<T>(db: PGlite, userId: string, fn: (tx: Tx) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await tx.exec("set local role authenticated");
    return fn(tx);
  });
}

/** Runs `fn` as server-side code using the service-role key (bypasses RLS). */
export async function asService<T>(db: PGlite, fn: (tx: Tx) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role service_role");
    return fn(tx);
  });
}

export async function one<T = Record<string, unknown>>(
  tx: Tx | PGlite,
  sql: string,
  params: unknown[] = []
): Promise<T> {
  const res = await tx.query<T>(sql, params);
  if (res.rows.length !== 1) throw new Error(`expected 1 row, got ${res.rows.length}: ${sql}`);
  return res.rows[0];
}

let counter = 0;
const uuid = () => crypto.randomUUID();

/** Creates a practice with one owner, as the Stripe webhook would. */
export async function seedPractice(db: PGlite, name = `Practice ${++counter}`) {
  const userId = uuid();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [userId, `${userId}@example.com`]);
  const practice = await one<{ id: string }>(
    db,
    "insert into practices (name, slug, status, plan) values ($1, $2, 'active', 'practice') returning id",
    [name, `${name.toLowerCase().replace(/\W+/g, "-")}-${counter}`]
  );
  await db.query(
    "insert into practice_members (practice_id, user_id, role) values ($1, $2, 'owner')",
    [practice.id, userId]
  );
  return { practiceId: practice.id, userId };
}

/** Adds a patient + granted quote_followup consent + treatment, as Add Treatment does. */
export async function seedTreatment(
  db: PGlite,
  { practiceId, userId }: { practiceId: string; userId: string },
  phone = "+447700900123"
) {
  return asUser(db, userId, async (tx) => {
    const patient = await one<{ id: string }>(
      tx,
      "insert into patients (practice_id, full_name, phone) values ($1, 'Test Patient', $2) returning id",
      [practiceId, phone]
    );
    const consent = await one<{ id: string }>(
      tx,
      `insert into consents (practice_id, patient_id, category, granted, captured_by)
       values ($1, $2, 'quote_followup', true, $3) returning id`,
      [practiceId, patient.id, userId]
    );
    const treatment = await one<{ id: string }>(
      tx,
      `insert into treatments (practice_id, patient_id, treatment_type, value_pence,
                               quote_followup_consent_id, created_by)
       values ($1, $2, 'Crown', 90000, $3, $4) returning id`,
      [practiceId, patient.id, consent.id, userId]
    );
    await tx.query(
      `insert into sequence_steps (treatment_id, practice_id, step, channel, scheduled_for)
       values ($1, $2, 'day_3', 'sms', now()), ($1, $2, 'day_7', 'sms', now() + interval '4 days')`,
      [treatment.id, practiceId]
    );
    return { patientId: patient.id, consentId: consent.id, treatmentId: treatment.id };
  });
}
