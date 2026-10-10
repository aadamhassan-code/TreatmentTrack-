-- Phase 6: dentists. A Dentist login sees and manages only their own
-- quotes; quotes record the treating dentist; and an associate can start
-- an account that only sends once the practice owner has approved it.
-- Run this once in the Supabase SQL editor after 0004.

-- ---------------------------------------------------------------------------
-- Dentist role and treating-dentist details on team members
-- ---------------------------------------------------------------------------
alter table practice_members drop constraint if exists practice_members_role_check;
alter table practice_members add constraint practice_members_role_check
  check (role in ('owner', 'staff', 'dentist'));

-- How the dentist is named in messages and lists, e.g. "Dr Patel".
alter table practice_members add column display_name text;
-- Owners or staff who also see patients can have quotes assigned to them.
alter table practice_members add column treats_patients boolean not null default false;
-- Their practitioner id in Dentally (matched by email, or set by an owner).
alter table practice_members add column dentally_practitioner_id text;

-- ---------------------------------------------------------------------------
-- Quotes record the treating dentist
-- ---------------------------------------------------------------------------
alter table treatments add column dentist_user_id uuid references auth.users(id) on delete set null;
create index if not exists treatments_practice_dentist_idx on treatments (practice_id, dentist_user_id);

alter table pms_quote_candidates add column external_practitioner_id text;
alter table pms_quote_candidates add column dentist_user_id uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- A Dentist login only sees — and can only change — their own quotes, their
-- messages and their Dentally plans. (Restrictive policies are ANDed with
-- the existing practice-wide ones.) Patients stay visible practice-wide so
-- the same patient isn't created twice.
-- ---------------------------------------------------------------------------
create policy treatments_dentist_own on treatments
  as restrictive
  for all
  using (coalesce(current_practice_role(), '') <> 'dentist' or dentist_user_id = auth.uid())
  with check (coalesce(current_practice_role(), '') <> 'dentist' or dentist_user_id = auth.uid());

create policy sequence_steps_dentist_own on sequence_steps
  as restrictive
  for all
  using (
    coalesce(current_practice_role(), '') <> 'dentist'
    or exists (select 1 from treatments t where t.id = treatment_id and t.dentist_user_id = auth.uid())
  );

create policy pms_quote_candidates_dentist_own on pms_quote_candidates
  as restrictive
  for all
  using (coalesce(current_practice_role(), '') <> 'dentist' or dentist_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Dentist-first accounts: nothing is sent until the practice owner approves
-- ---------------------------------------------------------------------------
alter table practices add column requires_owner_approval boolean not null default false;
alter table practices add column owner_approved_at timestamptz;
alter table practices add column owner_approved_by_name text;
alter table practices add column owner_approved_by_email text;
alter table practices add column approval_requested_email text;
-- SHA-256 of the one-time approval link's token; the token itself is
-- never stored.
alter table practices add column approval_token_hash text;
