-- Phase 9: UK GDPR housekeeping — erasure, an audit trail, retention and
-- privacy-conscious default wording.
-- Run this once in the Supabase SQL editor after 0007.

-- ---------------------------------------------------------------------------
-- Consent history stays append-only for everyone, except inside the erasure
-- and purge functions below, which set a transaction-local flag. Without
-- this, deleting a patient (or closing a practice) was impossible: the
-- cascade into consents hit the append-only trigger, so a right-to-erasure
-- request could not be met.
-- ---------------------------------------------------------------------------
create or replace function prevent_consent_mutation()
returns trigger
language plpgsql
as $$
begin
  if current_setting('tt.erasing', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  raise exception 'consents are append-only: insert a new row instead of changing history';
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit trail of sensitive actions, readable by the practice owner.
-- Written only through record_audit_event() and the functions below.
-- ---------------------------------------------------------------------------
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'patient_exported', 'patient_erased', 'retention_erased', 'mfa_enrolled', 'mfa_removed'
  )),
  subject_id uuid,
  detail text check (char_length(detail) <= 500),
  created_at timestamptz not null default now()
);
create index audit_events_practice_idx on audit_events (practice_id, created_at desc);

alter table audit_events enable row level security;
revoke insert, update, delete on audit_events from anon, authenticated;

create policy audit_events_owner_read on audit_events
  for select using (practice_id = current_practice_id() and current_practice_role() = 'owner');

create or replace function record_audit_event(p_action text, p_subject uuid, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_practice_id() is null then
    raise exception 'not signed in to a practice';
  end if;
  insert into audit_events (practice_id, actor_user_id, action, subject_id, detail)
  values (current_practice_id(), auth.uid(), p_action, p_subject, p_detail);
end;
$$;
revoke all on function record_audit_event(text, uuid, text) from public, anon;
grant execute on function record_audit_event(text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Erasure. A patient's personal details and everything about their
-- treatment are removed; what remains is a pseudonymous do-not-contact
-- marker (a salted hash of their number) so the same person can never be
-- quietly re-imported and messaged again, plus their consent rows with
-- notes removed, as evidence that past messages were lawful.
-- ---------------------------------------------------------------------------
alter table patients add column erased_at timestamptz;

create or replace function phone_suppression_key(p_practice_id uuid, p_phone text)
returns text
language sql
immutable
as $$
  select 'erased:' || encode(sha256(convert_to(p_practice_id::text || ':' || p_phone, 'UTF8')), 'hex');
$$;

create or replace function erase_patient_internal(p_patient_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient patients%rowtype;
begin
  select * into v_patient from patients where id = p_patient_id for update;
  if not found or v_patient.erased_at is not null then
    return false;
  end if;

  perform set_config('tt.erasing', 'on', true);

  -- Copies of the patient's details held on imported treatment plans.
  delete from pms_quote_candidates c
  where c.practice_id = v_patient.practice_id
    and (c.phone = v_patient.phone
         or c.treatment_id in (select t.id from treatments t where t.patient_id = p_patient_id));

  delete from cases
  where patient_id = p_patient_id
     or treatment_id in (select t.id from treatments t where t.patient_id = p_patient_id);
  delete from visits where patient_id = p_patient_id;
  delete from treatments where patient_id = p_patient_id;  -- and their scheduled messages

  update consents set notes = null where patient_id = p_patient_id;

  update patients set
    full_name = 'Erased patient',
    phone = phone_suppression_key(practice_id, phone),
    email = null,
    opted_out_at = coalesce(opted_out_at, now()),
    erased_at = now()
  where id = p_patient_id;

  perform set_config('tt.erasing', 'off', true);
  return true;
end;
$$;
revoke all on function erase_patient_internal(uuid) from public, anon, authenticated;

-- Called from the app by an owner or staff member of the patient's practice.
create or replace function erase_patient(p_patient_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_practice uuid;
begin
  select practice_id into v_practice from patients where id = p_patient_id;
  if v_practice is null or v_practice is distinct from current_practice_id() then
    raise exception 'patient not found';
  end if;
  if coalesce(current_practice_role(), '') not in ('owner', 'staff') then
    raise exception 'only owners and staff can erase a patient';
  end if;

  if erase_patient_internal(p_patient_id) then
    insert into audit_events (practice_id, actor_user_id, action, subject_id)
    values (v_practice, auth.uid(), 'patient_erased', p_patient_id);
  end if;
end;
$$;
revoke all on function erase_patient(uuid) from public, anon;
grant execute on function erase_patient(uuid) to authenticated;

-- Someone who was erased and then turns up again (a new import, a new
-- quote) starts opted out: follow-up can't begin unless staff record a
-- fresh request from them, exactly as after a STOP.
create or replace function apply_erasure_suppression()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from patients p
    where p.practice_id = new.practice_id
      and p.phone = phone_suppression_key(new.practice_id, new.phone)
  ) then
    new.opted_out_at := coalesce(new.opted_out_at, now());
  end if;
  return new;
end;
$$;

create trigger patients_erasure_suppression
before insert on patients
for each row execute function apply_erasure_suppression();

-- ---------------------------------------------------------------------------
-- Retention. Patients with nothing open (no quote still being followed up,
-- no active case) are erased once they've been inactive for the practice's
-- retention period. Run daily by the retention cron (service role only).
-- ---------------------------------------------------------------------------
alter table settings add column retention_months smallint not null default 24
  check (retention_months between 6 and 120);

create or replace function apply_retention(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select p.id, p.practice_id
    from patients p
    join settings s on s.practice_id = p.practice_id
    where p.erased_at is null
      and not exists (
        select 1 from treatments t
        where t.patient_id = p.id and t.status::text in ('in_sequence', 'future_intent')
      )
      and not exists (select 1 from cases c where c.patient_id = p.id and c.status = 'active')
      and greatest(
            p.created_at,
            coalesce((select max(t.updated_at) from treatments t where t.patient_id = p.id), p.created_at),
            coalesce((select max(c.updated_at) from cases c where c.patient_id = p.id), p.created_at),
            coalesce((select max(v.created_at) from visits v where v.patient_id = p.id), p.created_at)
          ) < p_now - make_interval(months => s.retention_months)
  loop
    if erase_patient_internal(r.id) then
      insert into audit_events (practice_id, action, subject_id, detail)
      values (r.practice_id, 'retention_erased', r.id, 'Inactive beyond the retention period');
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke all on function apply_retention(timestamptz) from public, anon, authenticated;
grant execute on function apply_retention(timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Closing a practice for good: deletes everything it holds. Service role
-- only (run by the TreatmentTrack team on a confirmed closure request).
-- ---------------------------------------------------------------------------
create or replace function purge_practice(p_practice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('tt.erasing', 'on', true);
  -- Cases first: boards refuse to be deleted while they hold active cases.
  delete from cases where practice_id = p_practice_id;
  delete from practices where id = p_practice_id;
  perform set_config('tt.erasing', 'off', true);
end;
$$;
revoke all on function purge_practice(uuid) from public, anon, authenticated;
grant execute on function purge_practice(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Privacy-conscious defaults. A treatment named next to a patient's name
-- is health data, and texts are read on lock screens and shared phones, so
-- new practices start with wording that doesn't name the treatment.
-- Existing practices' templates are untouched; the template editor warns
-- when {treatmentType} is used.
-- ---------------------------------------------------------------------------
create or replace function seed_practice_defaults()
returns trigger
language plpgsql
as $$
begin
  insert into settings (practice_id) values (new.id);

  insert into message_templates (practice_id, step, channel, body) values
    (new.id, 1, 'sms',
     'Hi {patientName}, just checking in about the treatment we discussed at {practiceName}. Ready to book, or have questions? Reply STOP to opt out.'),
    (new.id, 2, 'sms',
     'Hi {patientName}, your treatment plan from {practiceName} is still open. Happy to talk it through before you decide. Reply STOP to opt out.'),
    (new.id, 3, 'sms',
     'Hi {patientName}, a gentle nudge from {practiceName} about the treatment plan we discussed. Give us a call whenever suits. Reply STOP to opt out.'),
    (new.id, 4, 'sms',
     'Last check-in from {practiceName}: your treatment plan is here whenever you''re ready. Reply STOP to opt out.'),
    (new.id, 1, 'email',
     E'Hi {patientName},\n\nJust checking in about the treatment we discussed at {practiceName}. If you have any questions, or you''d like to book, simply reply to this email or give us a call.\n\nKind regards,\n{practiceName}'),
    (new.id, 2, 'email',
     E'Hi {patientName},\n\nYour treatment plan from {practiceName} is still open. We''re happy to talk it through with you before you decide — just reply to this email.\n\nKind regards,\n{practiceName}'),
    (new.id, 3, 'email',
     E'Hi {patientName},\n\nA gentle reminder from {practiceName} about the treatment plan we discussed. Get in touch whenever suits you.\n\nKind regards,\n{practiceName}'),
    (new.id, 4, 'email',
     E'Hi {patientName},\n\nThis is our last check-in about your treatment plan — it''s here whenever you''re ready.\n\nKind regards,\n{practiceName}');

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Two-factor sign-in, enforced by the database. Once a user has a verified
-- authenticator, their password-only session (aal1) can't read or change
-- any patient data — not through the app and not by calling the API
-- directly. Users without two-factor are unaffected. The server's
-- service role (crons, webhooks) bypasses row-level security as before.
-- Pattern from Supabase's "enforce MFA for enrolled users" guide.
-- ---------------------------------------------------------------------------
create or replace function mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'patients', 'consents', 'treatments', 'sequence_steps', 'visits', 'cases',
    'case_events', 'pms_quote_candidates', 'message_templates', 'audit_events'
  ]
  loop
    execute format(
      'create policy %I on %I as restrictive for all to authenticated using (mfa_satisfied()) with check (mfa_satisfied())',
      t || '_require_mfa_when_enrolled', t
    );
  end loop;
end;
$$;
