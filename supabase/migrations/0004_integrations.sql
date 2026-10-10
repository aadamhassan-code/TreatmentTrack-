-- Phase 4: practice management system integrations (Dentally).
-- Run this once in the Supabase SQL editor after 0003.

-- ---------------------------------------------------------------------------
-- Quotes can come from Dentally, and remember which Dentally treatment plan
-- they came from so a booking there can close them here.
-- ---------------------------------------------------------------------------
alter table treatments drop constraint if exists treatments_source_check;
alter table treatments add constraint treatments_source_check
  check (source in ('manual', 'csv_import', 'dentally'));

alter table treatments add column external_id text;

create index if not exists treatments_practice_external_idx
  on treatments (practice_id, source, external_id) where external_id is not null;

-- ---------------------------------------------------------------------------
-- Connections. The API key is encrypted by the app before it's stored, and
-- signed-in users can't read that column at all — only server code using
-- the service role can, after checking the caller is an owner.
-- ---------------------------------------------------------------------------
create table integrations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  provider text not null check (provider in ('dentally')),
  region text not null default 'uk' check (region in ('uk', 'sandbox')),
  encrypted_api_key text not null,
  -- Who in Dentally the key belongs to, shown so owners know whose key it is.
  account_label text,
  last_synced_at timestamptz,
  last_sync_error text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (practice_id, provider)
);

alter table integrations enable row level security;

revoke all on integrations from anon, authenticated;
grant select (id, practice_id, provider, region, account_label, last_synced_at, last_sync_error, created_at)
  on integrations to authenticated;

create policy integrations_member_read on integrations
  for select using (practice_id = current_practice_id());

-- ---------------------------------------------------------------------------
-- Unbooked treatment plans found in Dentally, waiting for staff to confirm
-- the patient was offered an opt-out before any follow-up starts.
-- ---------------------------------------------------------------------------
create table pms_quote_candidates (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  provider text not null check (provider in ('dentally')),
  external_plan_id text not null,
  external_patient_id text not null,
  patient_name text not null,
  phone text,
  email text,
  treatment_type text not null,
  value_pence integer not null check (value_pence > 0),
  quoted_on date not null,
  -- Why this one can't be followed up (e.g. marketing switched off in
  -- Dentally, no mobile number). NULL = fine to start.
  blocked_reason text,
  status text not null default 'pending' check (status in ('pending', 'started', 'dismissed', 'booked')),
  treatment_id uuid references treatments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (practice_id, provider, external_plan_id)
);

create trigger pms_quote_candidates_set_updated_at
before update on pms_quote_candidates
for each row execute function set_updated_at();

alter table pms_quote_candidates enable row level security;

create policy pms_quote_candidates_member_read on pms_quote_candidates
  for select using (practice_id = current_practice_id());

-- Staff mark candidates started or dismissed; the sync (service role) adds them.
create policy pms_quote_candidates_member_update on pms_quote_candidates
  for update
  using (practice_id = current_practice_id())
  with check (practice_id = current_practice_id());
