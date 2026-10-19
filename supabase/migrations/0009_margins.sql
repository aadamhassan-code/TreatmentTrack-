-- Phase 10: estimated margins for practice owners.
-- Run this once in the Supabase SQL editor after 0008.
--
-- Two inputs, both optional and owner-only:
--   * each treating dentist's share of fees (associate pay %), and
--   * a typical lab & materials cost per kind of treatment (per case board).
-- Reports then estimate practice margin on booked treatment as
--   (fee − lab cost) × (1 − dentist share)
-- i.e. lab bills shared in the same proportion as fees, the usual UK
-- associate arrangement. They are estimates, labelled as such.

-- Associate pay shares are kept apart from practice_members so that
-- dentists, who can see the team list, can't see each other's terms.
create table dentist_pay_rates (
  practice_id uuid not null references practices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  share_pct numeric(5, 2) not null check (share_pct between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (practice_id, user_id)
);

alter table dentist_pay_rates enable row level security;

create policy dentist_pay_rates_owner_all on dentist_pay_rates
  for all
  using (practice_id = current_practice_id() and current_practice_role() = 'owner')
  with check (practice_id = current_practice_id() and current_practice_role() = 'owner');

-- A dentist may see their own rate (it's their contract), nobody else's.
create policy dentist_pay_rates_self_read on dentist_pay_rates
  for select using (user_id = auth.uid() and practice_id = current_practice_id());

create policy dentist_pay_rates_require_mfa_when_enrolled on dentist_pay_rates
  as restrictive for all to authenticated
  using (mfa_satisfied()) with check (mfa_satisfied());

-- Typical lab & materials cost as a share of the fee, per kind of treatment.
alter table case_boards add column lab_cost_pct numeric(5, 2)
  check (lab_cost_pct is null or lab_cost_pct between 0 and 100);

-- ---------------------------------------------------------------------------
-- Contact requests now say what they're about, so the back office can tell
-- a support question from a sales lead.
-- ---------------------------------------------------------------------------
alter table callback_requests add column topic text not null default 'sales'
  check (topic in ('sales', 'walkthrough', 'support'));
alter table callback_requests add column practice_name text check (char_length(practice_name) <= 200);
