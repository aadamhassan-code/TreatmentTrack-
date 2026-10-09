-- Phase 2: Booked / Declined / Lost outcomes, quote dates, CSV import.
-- Run this once in the Supabase SQL editor after 0001_init.sql.

-- "Declined" = the patient told us no. "Lost" = they went quiet or went
-- elsewhere. "Booked" stays stored as 'converted' so existing rows and the
-- Stripe-era code keep working; the app just labels it "Booked".
alter type treatment_status add value if not exists 'declined';

alter table treatments add column declined_at timestamptz;

-- The date the patient was actually quoted, which can be earlier than the
-- day it was entered (e.g. quotes brought in by CSV import). Reports group
-- quotes by this date.
alter table treatments add column quoted_on date not null default current_date;
update treatments set quoted_on = created_at::date;

alter table treatments add column source text not null default 'manual'
  check (source in ('manual', 'csv_import'));

-- Whenever a quote is closed (booked, declined or lost) — from any screen —
-- stamp when it happened and cancel any follow-up messages still waiting to
-- go out. Doing this in the database means no code path can forget it.
-- Compares status as text so this file doesn't use the new 'declined' enum
-- value in the same transaction that creates it.
create or replace function on_treatment_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status::text = 'converted' then
      new.converted_at := coalesce(new.converted_at, now());
    elsif new.status::text = 'declined' then
      new.declined_at := coalesce(new.declined_at, now());
    elsif new.status::text = 'lost' then
      new.lost_at := coalesce(new.lost_at, now());
    end if;
  end if;
  return new;
end;
$$;

create trigger treatments_status_timestamps
before update of status on treatments
for each row execute function on_treatment_status_change();

create or replace function cancel_steps_for_closed_treatment()
returns trigger
language plpgsql
as $$
begin
  if new.status::text in ('converted', 'declined', 'lost')
     and new.status is distinct from old.status then
    update sequence_steps
    set status = 'canceled', error = 'Quote closed'
    where treatment_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger treatments_closed_cancel_steps
after update of status on treatments
for each row execute function cancel_steps_for_closed_treatment();

create index if not exists treatments_practice_status_idx on treatments (practice_id, status);
create index if not exists treatments_practice_quoted_on_idx on treatments (practice_id, quoted_on);
