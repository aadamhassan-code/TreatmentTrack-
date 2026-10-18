-- Phase 8: the Cases board. Once a patient books, their treatment is
-- tracked stage by stage (e.g. implant: consultation → consent signed →
-- implant placed → healing → scan → crown fitted → completed), Trello-style.
-- This tracks where a case is — stage, dates, who moved it and a short
-- admin note — never clinical notes. Nothing here sends patient messages.
-- Run this once in the Supabase SQL editor after 0006.

-- ---------------------------------------------------------------------------
-- Boards: one per kind of treatment, with the practice's own stages.
-- "Completed" is the built-in last column on every board, so it isn't a
-- stage here.
-- ---------------------------------------------------------------------------
create table case_boards (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- A booked quote goes on the first board (by position) whose words appear
  -- in its treatment type, e.g. {implant} matches "Implant crown UL6".
  keywords text[] not null default '{}' check (coalesce(array_length(keywords, 1), 0) <= 20),
  -- Quotes that match no board go on the catch-all board.
  is_default boolean not null default false,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create unique index case_boards_one_default on case_boards (practice_id) where is_default;
create index case_boards_practice_idx on case_boards (practice_id, position);

create table case_stages (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references case_boards(id) on delete cascade,
  practice_id uuid not null references practices(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- How long a case usually sits at this stage; longer and it's flagged
  -- as stuck. Null = no warning.
  expected_days smallint check (expected_days between 1 and 730),
  position smallint not null default 0
);
create index case_stages_board_idx on case_stages (board_id, position);

create table cases (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  board_id uuid references case_boards(id) on delete set null,
  stage_id uuid references case_stages(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'stopped')),
  -- Set when the case came from a booked quote; cases can also be added by
  -- hand (e.g. a patient who said yes at the consultation).
  treatment_id uuid unique references treatments(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  patient_name text not null check (char_length(btrim(patient_name)) between 1 and 120),
  treatment_type text not null check (char_length(btrim(treatment_type)) between 1 and 120),
  value_pence integer not null default 0 check (value_pence >= 0),
  dentist_user_id uuid references auth.users(id) on delete set null,
  -- A short admin note ("lab due back Tue"), not clinical notes.
  note text check (char_length(note) <= 280),
  stage_entered_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cases_practice_status_idx on cases (practice_id, status);
create index cases_board_idx on cases (board_id, status);

-- History of every move: what stage, when, and who moved it. Written only
-- by the triggers below, and can't be edited.
create table case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  practice_id uuid not null references practices(id) on delete cascade,
  kind text not null check (kind in ('started', 'moved', 'completed', 'stopped', 'reopened')),
  stage_name text,
  by_user uuid references auth.users(id) on delete set null,
  by_name text,
  created_at timestamptz not null default now()
);
create index case_events_case_idx on case_events (case_id, created_at);

alter table settings add column cases_auto_start boolean not null default true;

-- ---------------------------------------------------------------------------
-- Keep cases consistent: a case's stage belongs to its board, moving stage
-- restarts the "days at this stage" clock, and completing stamps the date.
-- ---------------------------------------------------------------------------
create or replace function cases_before_write()
returns trigger
language plpgsql
as $$
begin
  if new.board_id is not null and not exists (
    select 1 from case_boards b where b.id = new.board_id and b.practice_id = new.practice_id
  ) then
    raise exception 'case board must belong to the case''s practice';
  end if;
  if new.patient_id is not null and not exists (
    select 1 from patients p where p.id = new.patient_id and p.practice_id = new.practice_id
  ) then
    raise exception 'case patient must belong to the case''s practice';
  end if;
  if new.treatment_id is not null and not exists (
    select 1 from treatments t where t.id = new.treatment_id and t.practice_id = new.practice_id
  ) then
    raise exception 'case quote must belong to the case''s practice';
  end if;
  if new.stage_id is not null and not exists (
    select 1 from case_stages s where s.id = new.stage_id and s.board_id = new.board_id
  ) then
    raise exception 'case stage must belong to the case''s board';
  end if;

  if tg_op = 'UPDATE' then
    if new.stage_id is distinct from old.stage_id or new.status is distinct from old.status then
      new.stage_entered_at := now();
    end if;
    new.updated_at := now();
  end if;

  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger cases_before_write
before insert or update on cases
for each row execute function cases_before_write();

create or replace function cases_log_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_name text;
begin
  if tg_op = 'INSERT' then
    v_kind := case when new.status = 'completed' then 'completed' else 'started' end;
  elsif new.status is distinct from old.status then
    v_kind := case
      when new.status = 'completed' then 'completed'
      when new.status = 'stopped' then 'stopped'
      else 'reopened'
    end;
  elsif new.stage_id is distinct from old.stage_id then
    v_kind := 'moved';
  else
    return null;
  end if;

  select coalesce(nullif(btrim(m.display_name), ''), u.email)
  into v_name
  from auth.users u
  left join practice_members m on m.user_id = u.id and m.practice_id = new.practice_id
  where u.id = auth.uid();

  insert into case_events (case_id, practice_id, kind, stage_name, by_user, by_name)
  values (
    new.id, new.practice_id, v_kind,
    case when v_kind in ('completed', 'stopped') then null
         else (select s.name from case_stages s where s.id = new.stage_id) end,
    auth.uid(), v_name
  );
  return null;
end;
$$;

create trigger cases_log_event
after insert or update on cases
for each row execute function cases_log_event();

-- A stage or board can't be deleted while cases are still active on it.
create or replace function case_stages_guard_delete()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from cases c where c.stage_id = old.id and c.status = 'active') then
    raise exception 'stage still has active cases';
  end if;
  return old;
end;
$$;

create trigger case_stages_guard_delete
before delete on case_stages
for each row execute function case_stages_guard_delete();

create or replace function case_boards_guard_delete()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from cases c where c.board_id = old.id and c.status = 'active') then
    raise exception 'board still has active cases';
  end if;
  return old;
end;
$$;

create trigger case_boards_guard_delete
before delete on case_boards
for each row execute function case_boards_guard_delete();

-- ---------------------------------------------------------------------------
-- Booking a quote puts it on the right board automatically (unless the
-- practice turned that off); reopening the quote takes it off again.
-- ---------------------------------------------------------------------------
create or replace function pick_case_board(p_practice_id uuid, p_treatment_type text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id
  from case_boards b
  where b.practice_id = p_practice_id
    and (b.is_default or exists (
      select 1 from unnest(b.keywords) k
      where btrim(k) <> '' and position(lower(btrim(k)) in lower(p_treatment_type)) > 0
    ))
  order by b.is_default, b.position, b.created_at
  limit 1;
$$;

create or replace function start_case_for_booked_treatment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board uuid;
  v_stage uuid;
begin
  if new.status::text = 'converted' and (tg_op = 'INSERT' or old.status::text <> 'converted') then
    if exists (select 1 from cases where treatment_id = new.id) then
      update cases set status = 'active' where treatment_id = new.id and status = 'stopped';
      return null;
    end if;
    if not coalesce((select cases_auto_start from settings where practice_id = new.practice_id), true) then
      return null;
    end if;
    v_board := pick_case_board(new.practice_id, new.treatment_type);
    if v_board is null then
      return null;
    end if;
    select id into v_stage from case_stages where board_id = v_board order by position limit 1;
    insert into cases (practice_id, board_id, stage_id, treatment_id, patient_id, patient_name,
                       treatment_type, value_pence, dentist_user_id, created_by)
    select new.practice_id, v_board, v_stage, new.id, new.patient_id, p.full_name,
           new.treatment_type, new.value_pence, new.dentist_user_id, auth.uid()
    from patients p where p.id = new.patient_id;
  elsif tg_op = 'UPDATE' and old.status::text = 'converted' and new.status::text <> 'converted' then
    update cases set status = 'stopped' where treatment_id = new.id and status = 'active';
  end if;
  return null;
end;
$$;

create trigger treatments_start_case
after insert or update of status on treatments
for each row execute function start_case_for_booked_treatment();

revoke all on function pick_case_board(uuid, text) from public, anon, authenticated;
revoke all on function start_case_for_booked_treatment() from public, anon, authenticated;
revoke all on function cases_log_event() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Starting boards for every practice (new and existing). Owners can rename,
-- reorder and change all of these in Settings.
-- ---------------------------------------------------------------------------
create or replace function seed_case_boards(p_practice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board uuid;
begin
  insert into case_boards (practice_id, name, keywords, position)
  values (p_practice_id, 'Implants', '{implant}', 1) returning id into v_board;
  insert into case_stages (board_id, practice_id, name, expected_days, position) values
    (v_board, p_practice_id, 'Consultation', 14, 1),
    (v_board, p_practice_id, 'Consent signed', 28, 2),
    (v_board, p_practice_id, 'Implant placed', 7, 3),
    (v_board, p_practice_id, 'Healing', 90, 4),
    (v_board, p_practice_id, 'Scan done', 21, 5),
    (v_board, p_practice_id, 'Crown fitted', 14, 6);

  insert into case_boards (practice_id, name, keywords, position)
  values (p_practice_id, 'Aligners & ortho', '{aligner,invisalign,ortho,brace,clear correct,spark}', 2)
  returning id into v_board;
  insert into case_stages (board_id, practice_id, name, expected_days, position) values
    (v_board, p_practice_id, 'Consultation', 14, 1),
    (v_board, p_practice_id, 'Records taken', 14, 2),
    (v_board, p_practice_id, 'Plan approved', 21, 3),
    (v_board, p_practice_id, 'Aligners fitted', 180, 4),
    (v_board, p_practice_id, 'Refinements', 120, 5),
    (v_board, p_practice_id, 'Retainers', 30, 6);

  insert into case_boards (practice_id, name, keywords, position)
  values (p_practice_id, 'Crowns, bridges & veneers', '{crown,bridge,veneer,onlay,inlay}', 3)
  returning id into v_board;
  insert into case_stages (board_id, practice_id, name, expected_days, position) values
    (v_board, p_practice_id, 'Prep', 14, 1),
    (v_board, p_practice_id, 'Scan / impressions', 3, 2),
    (v_board, p_practice_id, 'Lab', 21, 3),
    (v_board, p_practice_id, 'Fitted', 14, 4);

  insert into case_boards (practice_id, name, keywords, position)
  values (p_practice_id, 'Whitening', '{whiten}', 4) returning id into v_board;
  insert into case_stages (board_id, practice_id, name, expected_days, position) values
    (v_board, p_practice_id, 'Impressions / scan', 14, 1),
    (v_board, p_practice_id, 'Trays fitted', 28, 2);

  insert into case_boards (practice_id, name, keywords, is_default, position)
  values (p_practice_id, 'Other treatment', '{}', true, 5) returning id into v_board;
  insert into case_stages (board_id, practice_id, name, expected_days, position) values
    (v_board, p_practice_id, 'Booked', 30, 1),
    (v_board, p_practice_id, 'In treatment', 90, 2);
end;
$$;

create or replace function seed_case_boards_for_new_practice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform seed_case_boards(new.id);
  return new;
end;
$$;

create trigger practices_seed_case_boards
after insert on practices
for each row execute function seed_case_boards_for_new_practice();

select seed_case_boards(id) from practices;

revoke all on function seed_case_boards(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security. Everyone in the practice sees the boards; only an
-- owner changes their stages. Cases work like quotes: a Dentist login only
-- sees and moves their own.
-- ---------------------------------------------------------------------------
alter table case_boards enable row level security;
alter table case_stages enable row level security;
alter table cases enable row level security;
alter table case_events enable row level security;

create policy case_boards_member_read on case_boards
  for select using (practice_id = current_practice_id());
create policy case_boards_owner_write on case_boards
  for all
  using (practice_id = current_practice_id() and current_practice_role() = 'owner')
  with check (practice_id = current_practice_id() and current_practice_role() = 'owner');

create policy case_stages_member_read on case_stages
  for select using (practice_id = current_practice_id());
create policy case_stages_owner_write on case_stages
  for all
  using (practice_id = current_practice_id() and current_practice_role() = 'owner')
  with check (
    practice_id = current_practice_id() and current_practice_role() = 'owner'
    and exists (select 1 from case_boards b where b.id = board_id and b.practice_id = current_practice_id())
  );

create policy cases_tenant_isolation on cases
  for all using (practice_id = current_practice_id())
  with check (practice_id = current_practice_id());
create policy cases_dentist_own on cases
  as restrictive
  for all
  using (coalesce(current_practice_role(), '') <> 'dentist' or dentist_user_id = auth.uid())
  with check (coalesce(current_practice_role(), '') <> 'dentist' or dentist_user_id = auth.uid());
-- Cases are taken off the board (stopped), never deleted through the app.
revoke delete on cases from anon, authenticated;

create policy case_events_member_read on case_events
  for select using (
    practice_id = current_practice_id()
    and (
      coalesce(current_practice_role(), '') <> 'dentist'
      or exists (select 1 from cases c where c.id = case_id and c.dentist_user_id = auth.uid())
    )
  );
revoke insert, update, delete on case_events from anon, authenticated;
