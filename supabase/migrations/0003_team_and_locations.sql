-- Phase 3: team members with roles, and multi-location (Multisite) accounts.
-- Run this once in the Supabase SQL editor after 0002.

-- ---------------------------------------------------------------------------
-- Locations: extra practices billed under one subscription
-- ---------------------------------------------------------------------------
-- NULL = this practice holds the Stripe subscription itself. Set = an extra
-- location billed under that practice (Multisite: up to 5 in total).
alter table practices
  add column billing_practice_id uuid references practices(id) on delete cascade;

-- How many locations (including the billing practice) each plan allows.
-- NULL = no limit.
create or replace function plan_location_limit(p_plan practice_plan)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'multisite' then 5
    when 'enterprise' then null
    else 1
  end;
$$;

-- Refuse to add a location beyond the plan's limit, or under a practice
-- that is itself an extra location.
create or replace function check_location_limit()
returns trigger
language plpgsql
as $$
declare
  v_root practices%rowtype;
  v_count integer;
  v_limit integer;
begin
  if new.billing_practice_id is null then
    return new;
  end if;

  select * into v_root from practices where id = new.billing_practice_id;
  if v_root.billing_practice_id is not null then
    raise exception 'locations must be billed under the practice that holds the subscription';
  end if;

  v_limit := plan_location_limit(v_root.plan);
  select count(*) into v_count
  from practices
  where id = v_root.id or billing_practice_id = v_root.id;

  if v_limit is not null and v_count >= v_limit then
    raise exception 'this plan allows % location(s); upgrade to add more', v_limit;
  end if;
  return new;
end;
$$;

create trigger practices_location_limit
before insert on practices
for each row execute function check_location_limit();

-- When the billing practice's subscription changes (Stripe webhook), every
-- location billed under it follows — a cancelled subscription stops
-- follow-ups at every site, not just the first.
create or replace function sync_locations_with_billing_practice()
returns trigger
language plpgsql
as $$
begin
  if new.billing_practice_id is null
     and (new.status is distinct from old.status
          or new.plan is distinct from old.plan
          or new.billing_interval is distinct from old.billing_interval) then
    update practices
    set status = new.status, plan = new.plan, billing_interval = new.billing_interval
    where billing_practice_id = new.id;
  end if;
  return new;
end;
$$;

create trigger practices_sync_locations
after update on practices
for each row execute function sync_locations_with_billing_practice();

-- ---------------------------------------------------------------------------
-- Which practice a user is working in (for people with more than one)
-- ---------------------------------------------------------------------------
create table user_active_practice (
  user_id uuid primary key references auth.users(id) on delete cascade,
  practice_id uuid not null references practices(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table user_active_practice enable row level security;

create policy user_active_practice_self on user_active_practice
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from practice_members m
      where m.user_id = auth.uid() and m.practice_id = user_active_practice.practice_id
    )
  );

-- The practice every row-level security policy is keyed off: the one the
-- user switched to (if they're still a member of it), otherwise the first
-- practice they joined.
create or replace function current_practice_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select a.practice_id
     from user_active_practice a
     join practice_members m on m.practice_id = a.practice_id and m.user_id = a.user_id
     where a.user_id = auth.uid()),
    (select practice_id from practice_members
     where user_id = auth.uid()
     order by created_at, practice_id
     limit 1)
  );
$$;

-- 'owner' or 'staff' in the current practice.
create or replace function current_practice_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from practice_members
  where user_id = auth.uid() and practice_id = current_practice_id();
$$;

-- ---------------------------------------------------------------------------
-- Visibility: the switcher lists every practice you belong to; the Team
-- page lists everyone in the current practice.
-- ---------------------------------------------------------------------------
create policy practices_member_list on practices
  for select using (
    id in (select practice_id from practice_members where user_id = auth.uid())
  );

create policy practice_members_team_read on practice_members
  for select using (practice_id = current_practice_id());

-- Team changes (invite, remove, change role) are made server-side with the
-- service role after checking the caller is an owner — deliberately no
-- insert/update/delete policies here, so nobody can promote themselves.

-- ---------------------------------------------------------------------------
-- Owner-only: settings and message templates
-- ---------------------------------------------------------------------------
drop policy settings_tenant_isolation on settings;

create policy settings_member_read on settings
  for select using (practice_id = current_practice_id());

create policy settings_owner_update on settings
  for update
  using (practice_id = current_practice_id() and current_practice_role() = 'owner')
  with check (practice_id = current_practice_id() and current_practice_role() = 'owner');

drop policy message_templates_tenant_isolation on message_templates;

create policy message_templates_member_read on message_templates
  for select using (practice_id = current_practice_id());

create policy message_templates_owner_write on message_templates
  for all
  using (practice_id = current_practice_id() and current_practice_role() = 'owner')
  with check (practice_id = current_practice_id() and current_practice_role() = 'owner');
