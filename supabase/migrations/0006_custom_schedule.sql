-- Phase 7: each practice chooses its own follow-up schedule (1–6 messages,
-- each "after N days"), and any quote can be paused until a date.
-- Run this once in the Supabase SQL editor after 0005.

-- ---------------------------------------------------------------------------
-- Messages are numbered 1–6 instead of the fixed day_3 / day_7 / day_14 /
-- day_30. Existing templates and scheduled messages keep their place
-- (day_3 → 1, day_7 → 2, day_14 → 3, day_30 → 4).
-- ---------------------------------------------------------------------------
alter table message_templates add column step_no smallint;
update message_templates set step_no = case step::text
  when 'day_3' then 1 when 'day_7' then 2 when 'day_14' then 3 when 'day_30' then 4 end;
alter table message_templates drop column step;
alter table message_templates rename column step_no to step;
alter table message_templates alter column step set not null;
alter table message_templates add constraint message_templates_step_range check (step between 1 and 6);
alter table message_templates add constraint message_templates_practice_step_channel_key unique (practice_id, step, channel);

alter table sequence_steps add column step_no smallint;
update sequence_steps set step_no = case step::text
  when 'day_3' then 1 when 'day_7' then 2 when 'day_14' then 3 when 'day_30' then 4 end;
alter table sequence_steps drop column step;
alter table sequence_steps rename column step_no to step;
alter table sequence_steps alter column step set not null;
alter table sequence_steps add constraint sequence_steps_step_range check (step between 1 and 6);

-- A quote can now restart its sequence (after a pause), so the same
-- message number may appear again — but never twice waiting to send.
create unique index sequence_steps_one_pending_per_step
  on sequence_steps (treatment_id, step, channel) where status = 'pending';

drop type sequence_step_name;

-- ---------------------------------------------------------------------------
-- The practice's schedule: days after the quote for each message.
-- ---------------------------------------------------------------------------
create or replace function valid_sequence_days(days smallint[])
returns boolean
language sql
immutable
as $$
  select coalesce(array_length(days, 1), 0) between 1 and 6
     and not exists (
       select 1 from unnest(days) with ordinality as d(v, i)
       where d.v < 1 or d.v > 365
          or (d.i > 1 and d.v <= days[d.i - 1])
     );
$$;

alter table settings add column sequence_days smallint[] not null default '{3,7,14,30}';
alter table settings add constraint settings_sequence_days_valid check (valid_sequence_days(sequence_days));

-- New practices still get default wording for messages 1–4.
create or replace function seed_practice_defaults()
returns trigger
language plpgsql
as $$
begin
  insert into settings (practice_id) values (new.id);

  insert into message_templates (practice_id, step, channel, body) values
    (new.id, 1, 'sms',
     'Hi {patientName}, just checking in about the {treatmentType} we quoted at {practiceName}. Ready to book, or have questions? Reply STOP to opt out.'),
    (new.id, 2, 'sms',
     'Hi {patientName}, your {treatmentType} quote from {practiceName} is still open. Happy to talk through it before you decide. Reply STOP to opt out.'),
    (new.id, 3, 'sms',
     '{patientName}, a gentle nudge from {practiceName} about the {treatmentType} we discussed. We can hold your quote a little longer. Reply STOP to opt out.'),
    (new.id, 4, 'sms',
     'Last check-in from {practiceName}: your {treatmentType} quote is still available whenever you''re ready. Reply STOP to opt out.'),
    (new.id, 1, 'email',
     E'Hi {patientName},\n\nJust checking in about the {treatmentType} we quoted at {practiceName}. If you have any questions, or you''d like to book, simply reply to this email or give us a call.\n\nKind regards,\n{practiceName}'),
    (new.id, 2, 'email',
     E'Hi {patientName},\n\nYour {treatmentType} quote from {practiceName} is still open. We''re happy to talk it through with you before you decide — just reply to this email.\n\nKind regards,\n{practiceName}'),
    (new.id, 3, 'email',
     E'Hi {patientName},\n\nA gentle reminder from {practiceName} about the {treatmentType} we discussed. We can hold your quote a little longer if that helps.\n\nKind regards,\n{practiceName}'),
    (new.id, 4, 'email',
     E'Hi {patientName},\n\nThis is our last check-in about your {treatmentType} quote — it''s still available whenever you''re ready.\n\nKind regards,\n{practiceName}');

  return new;
end;
$$;
