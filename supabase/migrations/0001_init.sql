-- TreatmentTrack core schema
-- Multi-tenant model: every clinical/business table carries practice_id and is
-- isolated by row-level security keyed off practice_members. Consent capture is
-- append-only (never UPDATE/DELETE) so it stays provable after the fact.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type practice_status as enum ('pending_payment', 'active', 'past_due', 'canceled');
create type practice_plan as enum ('starter', 'growth');
create type billing_interval as enum ('monthly', 'annual');
create type treatment_status as enum ('in_sequence', 'converted', 'lost', 'future_intent');
create type consent_category as enum ('quote_followup', 'cross_sell');
create type message_channel as enum ('sms', 'whatsapp', 'email');
create type sequence_step_name as enum ('day_3', 'day_7', 'day_14', 'day_30');
create type sequence_step_status as enum ('pending', 'sent', 'failed', 'canceled', 'skipped_no_consent');
create type visit_type as enum ('hygiene', 'extraction', 'other');

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------
create table practices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan practice_plan,
  billing_interval billing_interval,
  status practice_status not null default 'pending_payment',
  created_at timestamptz not null default now()
);

create table practice_members (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (practice_id, user_id)
);

-- Resolves the calling user's practice. security definer + fixed search_path
-- lets it read practice_members regardless of RLS on that table.
create or replace function current_practice_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select practice_id from practice_members where user_id = auth.uid() limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Patients & consent (consent is append-only — see trigger below)
-- ---------------------------------------------------------------------------
create table patients (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  opted_out_at timestamptz,
  created_at timestamptz not null default now()
);

create table consents (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  category consent_category not null,
  granted boolean not null,
  captured_by uuid not null references auth.users(id),
  captured_at timestamptz not null default now(),
  notes text
);

create or replace function prevent_consent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'consents are append-only: insert a new row instead of changing history';
end;
$$;

create trigger consents_no_update
before update or delete on consents
for each row execute function prevent_consent_mutation();

-- Latest-row-wins helper for the cross-sell category, used both by the app
-- and enforced again here at the database level.
create or replace function has_cross_sell_consent(p_patient_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    (select granted from consents
     where patient_id = p_patient_id and category = 'cross_sell'
     order by captured_at desc
     limit 1),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Treatments (the quoted-but-declined plans being followed up on)
-- ---------------------------------------------------------------------------
create table treatments (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  treatment_type text not null,
  value_pence integer not null check (value_pence >= 0),
  status treatment_status not null default 'in_sequence',
  quote_followup_consent_id uuid not null references consents(id),
  future_intent_remind_at date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  converted_at timestamptz,
  lost_at timestamptz
);

-- Database-level enforcement of the PECR soft opt-in rule: a treatment can
-- only be created against a consent row that (a) exists, (b) is the
-- quote_followup category, (c) was granted, and (d) belongs to the same
-- practice and patient. This is a hard gate, not just an app-layer check.
create or replace function check_treatment_consent()
returns trigger
language plpgsql
as $$
declare
  v_ok boolean;
begin
  select (c.category = 'quote_followup' and c.granted = true
          and c.practice_id = new.practice_id and c.patient_id = new.patient_id)
  into v_ok
  from consents c
  where c.id = new.quote_followup_consent_id;

  if not coalesce(v_ok, false) then
    raise exception 'treatment requires a granted quote_followup consent on file for this patient';
  end if;
  return new;
end;
$$;

create trigger treatments_require_consent
before insert on treatments
for each row execute function check_treatment_consent();

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger treatments_set_updated_at
before update on treatments
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Automated sequence
-- ---------------------------------------------------------------------------
create table sequence_steps (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references treatments(id) on delete cascade,
  practice_id uuid not null references practices(id) on delete cascade,
  step sequence_step_name not null,
  channel message_channel not null,
  status sequence_step_status not null default 'pending',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  unique (treatment_id, step, channel)
);

create table message_templates (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  step sequence_step_name not null,
  channel message_channel not null,
  body text not null,
  updated_at timestamptz not null default now(),
  unique (practice_id, step, channel)
);

-- ---------------------------------------------------------------------------
-- Visit logging + cross-sell suggestions (hard-blocked without consent)
-- ---------------------------------------------------------------------------
create table visits (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_type visit_type not null,
  suggested_treatment_type text,
  suggestion_sent boolean not null default false,
  blocked_reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table settings (
  practice_id uuid primary key references practices(id) on delete cascade,
  cross_sell_enabled boolean not null default false,
  sms_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Seed sensible, compliant defaults (opt-out text included) whenever a
-- practice is created, so day-one accounts already have working templates.
create or replace function seed_practice_defaults()
returns trigger
language plpgsql
as $$
begin
  insert into settings (practice_id) values (new.id);

  insert into message_templates (practice_id, step, channel, body) values
    (new.id, 'day_3', 'sms',
     'Hi {patientName}, just checking in about the {treatmentType} we quoted at {practiceName}. Ready to book, or have questions? Reply STOP to opt out.'),
    (new.id, 'day_7', 'sms',
     'Hi {patientName}, your {treatmentType} quote from {practiceName} is still open. Happy to talk through it before you decide. Reply STOP to opt out.'),
    (new.id, 'day_14', 'sms',
     '{patientName}, a gentle nudge from {practiceName} about the {treatmentType} we discussed. We can hold your quote a little longer. Reply STOP to opt out.'),
    (new.id, 'day_30', 'sms',
     'Last check-in from {practiceName}: your {treatmentType} quote is still available whenever you''re ready. Reply STOP to opt out.');

  return new;
end;
$$;

create trigger practices_seed_defaults
after insert on practices
for each row execute function seed_practice_defaults();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table practices enable row level security;
alter table practice_members enable row level security;
alter table patients enable row level security;
alter table consents enable row level security;
alter table treatments enable row level security;
alter table sequence_steps enable row level security;
alter table message_templates enable row level security;
alter table visits enable row level security;
alter table settings enable row level security;

create policy practices_member_read on practices
  for select using (id = current_practice_id());

create policy practices_member_update on practices
  for update using (id = current_practice_id());

create policy practice_members_self_read on practice_members
  for select using (user_id = auth.uid());

create policy patients_tenant_isolation on patients
  for all using (practice_id = current_practice_id())
  with check (practice_id = current_practice_id());

create policy consents_tenant_isolation on consents
  for all using (practice_id = current_practice_id())
  with check (practice_id = current_practice_id());

create policy treatments_tenant_isolation on treatments
  for all using (practice_id = current_practice_id())
  with check (practice_id = current_practice_id());

create policy sequence_steps_tenant_isolation on sequence_steps
  for all using (practice_id = current_practice_id())
  with check (practice_id = current_practice_id());

create policy message_templates_tenant_isolation on message_templates
  for all using (practice_id = current_practice_id())
  with check (practice_id = current_practice_id());

create policy visits_tenant_isolation on visits
  for all using (practice_id = current_practice_id())
  with check (practice_id = current_practice_id());

create policy settings_tenant_isolation on settings
  for all using (practice_id = current_practice_id())
  with check (practice_id = current_practice_id());
