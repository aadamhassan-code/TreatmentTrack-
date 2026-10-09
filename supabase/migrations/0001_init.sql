-- TreatmentTrack core schema
-- Multi-tenant model: every clinical/business table carries practice_id and is
-- isolated by row-level security keyed off practice_members. Consent capture is
-- append-only (never UPDATE/DELETE) so it stays provable after the fact.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type practice_status as enum ('pending_payment', 'active', 'past_due', 'canceled');
-- 'enterprise' is never sold through Stripe Checkout — accounts on that
-- tier are provisioned by hand after a callback_requests lead is closed.
create type practice_plan as enum ('solo', 'practice', 'multisite', 'enterprise');
create type billing_interval as enum ('monthly', 'annual');
create type treatment_status as enum ('in_sequence', 'converted', 'lost', 'future_intent');
create type consent_category as enum ('quote_followup', 'cross_sell');
create type message_channel as enum ('sms', 'whatsapp', 'email');
create type sequence_step_name as enum ('day_3', 'day_7', 'day_14', 'day_30');
create type sequence_step_status as enum ('pending', 'sent', 'failed', 'canceled', 'skipped_no_consent');
create type visit_type as enum ('hygiene', 'extraction', 'other');
-- Who recorded a consent row: a member of staff, or the patient themselves
-- (e.g. replying STOP). Staff rows must say which staff member.
create type consent_source as enum ('staff', 'patient_reply');

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
  source consent_source not null default 'staff',
  captured_by uuid references auth.users(id),
  captured_at timestamptz not null default now(),
  notes text,
  check (source <> 'staff' or captured_by is not null)
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

-- Latest-row-wins helper for the cross-sell category. The app checks this
-- before logging a suggestion, and the visits trigger below enforces it
-- again at the database level.
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

  -- A patient who has opted out (e.g. replied STOP) can't be put back into
  -- a sequence just by adding a new quote. Staff must first record that the
  -- patient asked to hear from the practice again — see
  -- check_patient_reconsent below.
  if exists (select 1 from patients p
             where p.id = new.patient_id and p.opted_out_at is not null) then
    raise exception 'patient has opted out of follow-up messages';
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

-- A cross-sell suggestion can only be marked as sent if the patient's most
-- recent cross_sell consent is a grant — the database-level twin of the
-- check in lib/actions/visits.ts.
create or replace function check_visit_cross_sell_consent()
returns trigger
language plpgsql
as $$
begin
  if new.suggestion_sent and not has_cross_sell_consent(new.patient_id) then
    raise exception 'cross-sell suggestion requires cross_sell consent for this patient';
  end if;
  return new;
end;
$$;

create trigger visits_require_cross_sell_consent
before insert or update on visits
for each row execute function check_visit_cross_sell_consent();

-- ---------------------------------------------------------------------------
-- Opt-out and re-consent
-- ---------------------------------------------------------------------------

-- Clearing an opt-out is only allowed if a fresh, granted quote_followup
-- consent was recorded *after* the patient opted out — i.e. the patient
-- has positively asked to hear from the practice again, and that request
-- is on the consent record.
create or replace function check_patient_reconsent()
returns trigger
language plpgsql
as $$
begin
  if old.opted_out_at is not null and new.opted_out_at is null then
    if not exists (
      select 1 from consents c
      where c.patient_id = new.id
        and c.category = 'quote_followup'
        and c.granted = true
        and c.captured_at > old.opted_out_at
    ) then
      raise exception 'cannot clear an opt-out without a new quote_followup consent recorded after it';
    end if;
  end if;
  return new;
end;
$$;

create trigger patients_require_reconsent
before update on patients
for each row execute function check_patient_reconsent();

-- Called by the inbound SMS/WhatsApp webhook when a patient replies STOP.
-- In one transaction, for every patient record with that number (across
-- all practices, since the reply can't be attributed to just one): marks
-- them opted out, appends a withdrawal to the consent history for both
-- categories, and cancels every pending message. Only the service role
-- (server-side webhook code) may call it.
create or replace function record_patient_opt_out(p_phone text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with matched as (
    update patients
    set opted_out_at = coalesce(opted_out_at, now())
    where phone = p_phone
    returning id, practice_id
  ),
  withdrawn as (
    insert into consents (practice_id, patient_id, category, granted, source, notes)
    select m.practice_id, m.id, cat.category, false, 'patient_reply',
           'Patient replied STOP to a follow-up message.'
    from matched m
    cross join (values ('quote_followup'::consent_category),
                       ('cross_sell'::consent_category)) as cat(category)
    returning 1
  ),
  canceled as (
    update sequence_steps s
    set status = 'canceled', error = 'Patient opted out'
    from treatments t
    where s.treatment_id = t.id
      and t.patient_id in (select id from matched)
      and s.status = 'pending'
    returning 1
  )
  -- Postgres always runs data-modifying CTEs to completion, even the ones
  -- not referenced in the final select.
  select count(*) into v_count from matched;
  return v_count;
end;
$$;

-- Supabase grants new functions to anon/authenticated by default, so
-- revoke those explicitly too.
revoke all on function record_patient_opt_out(text) from public, anon, authenticated;
grant execute on function record_patient_opt_out(text) to service_role;

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
     'Last check-in from {practiceName}: your {treatmentType} quote is still available whenever you''re ready. Reply STOP to opt out.'),
    (new.id, 'day_3', 'email',
     E'Hi {patientName},\n\nJust checking in about the {treatmentType} we quoted at {practiceName}. If you have any questions, or you''d like to book, simply reply to this email or give us a call.\n\nKind regards,\n{practiceName}'),
    (new.id, 'day_7', 'email',
     E'Hi {patientName},\n\nYour {treatmentType} quote from {practiceName} is still open. We''re happy to talk it through with you before you decide — just reply to this email.\n\nKind regards,\n{practiceName}'),
    (new.id, 'day_14', 'email',
     E'Hi {patientName},\n\nA gentle reminder from {practiceName} about the {treatmentType} we discussed. We can hold your quote a little longer if that helps.\n\nKind regards,\n{practiceName}'),
    (new.id, 'day_30', 'email',
     E'Hi {patientName},\n\nThis is our last check-in about your {treatmentType} quote — it''s still available whenever you''re ready.\n\nKind regards,\n{practiceName}');

  return new;
end;
$$;

create trigger practices_seed_defaults
after insert on practices
for each row execute function seed_practice_defaults();

-- ---------------------------------------------------------------------------
-- Callback requests (pre-account sales lead capture — no practice_id yet,
-- since the enquiry comes from a group considering more than 5 practices
-- and hasn't signed up through Stripe Checkout at all)
-- ---------------------------------------------------------------------------
create table callback_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  practice_count integer,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

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
alter table callback_requests enable row level security;

create policy practices_member_read on practices
  for select using (id = current_practice_id());

-- Deliberately no UPDATE policy on practices: plan, status and Stripe IDs
-- are only ever changed server-side by the Stripe webhook (service role),
-- so a practice can't reactivate or upgrade itself.

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

-- Anyone (including a signed-out visitor) can submit a callback request,
-- but nobody can read them back through the API — only via the
-- service-role key, so leads can't be scraped or enumerated by other
-- callback submitters.
create policy callback_requests_public_insert on callback_requests
  for insert
  to anon, authenticated
  with check (true);
