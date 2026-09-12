#!/usr/bin/env node
/**
 * Creates a working practice + owner login WITHOUT going through Stripe or
 * an email invite — for local testing only. Requires a real Supabase
 * project (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
 * .env.local) with the migration in supabase/migrations/0001_init.sql
 * already applied. Safe to re-run: it reuses the account if it exists.
 *
 * Usage:
 *   node scripts/dev-seed.mjs
 *   DEV_SEED_EMAIL=me@example.com DEV_SEED_PASSWORD=... node scripts/dev-seed.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  const contents = readFileSync(".env.local", "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || SUPABASE_URL.includes("placeholder")) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "Create a Supabase project, run supabase/migrations/0001_init.sql against it,\n" +
      "then copy its URL + service_role key into .env.local before running this script."
  );
  process.exit(1);
}

const email = process.env.DEV_SEED_EMAIL || "owner@example.com";
const password = process.env.DEV_SEED_PASSWORD || "TreatmentTrack123!";
const practiceName = process.env.DEV_SEED_PRACTICE_NAME || "Test Dental Practice";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function slugify(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base || "practice"}-${Math.random().toString(36).slice(2, 7)}`;
}

async function findUserByEmail(targetEmail) {
  // No direct "get user by email" in supabase-js — page through admin.listUsers.
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page++;
  }
}

async function main() {
  let userId;
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    if (!/already registered|already exists/i.test(createError.message)) {
      throw createError;
    }
    const existing = await findUserByEmail(email);
    if (!existing) throw createError;
    userId = existing.id;
    // Reset the password in case it's been forgotten between test runs.
    await supabase.auth.admin.updateUserById(userId, { password });
    console.log(`Reusing existing auth user ${email} and resetting password.`);
  } else {
    userId = created.user.id;
    console.log(`Created auth user ${email}.`);
  }

  const { data: existingMembership } = await supabase
    .from("practice_members")
    .select("practice_id, practices(name)")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMembership) {
    const practice = Array.isArray(existingMembership.practices)
      ? existingMembership.practices[0]
      : existingMembership.practices;
    console.log(`This user is already linked to practice "${practice?.name}". Nothing else to do.`);
  } else {
    const { data: practice, error: practiceError } = await supabase
      .from("practices")
      .insert({
        name: practiceName,
        slug: slugify(practiceName),
        plan: "practice",
        billing_interval: "monthly",
        status: "active",
      })
      .select("id, name")
      .single();

    if (practiceError) throw practiceError;

    const { error: memberError } = await supabase.from("practice_members").insert({
      practice_id: practice.id,
      user_id: userId,
      role: "owner",
    });

    if (memberError) throw memberError;

    console.log(`Created practice "${practice.name}" and linked it to ${email} as owner.`);
  }

  console.log("\nYou can now log in at http://localhost:3000/login with:");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message ?? err);
  process.exit(1);
});
