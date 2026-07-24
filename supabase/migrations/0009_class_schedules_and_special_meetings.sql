-- v1.3.0: recurring class schedules with automatically materialized meetings.
-- Run after migrations 0001 through 0008.

create table if not exists public.class_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  group_mapping_id uuid not null references public.ccb_group_mappings(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  time_zone text not null default 'America/New_York',
  checkin_opens_minutes_before integer not null default 30
    check (checkin_opens_minutes_before between 0 and 240),
  checkin_closes_minutes_after integer not null default 30
    check (checkin_closes_minutes_after between 0 and 240),
  enabled boolean not null default true,
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_schedule_slots_valid_time check (end_time > start_time),
  constraint class_schedule_slots_unique_start unique (group_mapping_id, day_of_week, start_time)
);

create index if not exists idx_class_schedule_slots_mapping
on public.class_schedule_slots(group_mapping_id, enabled, day_of_week, start_time);

drop trigger if exists set_class_schedule_slots_updated_at on public.class_schedule_slots;
create trigger set_class_schedule_slots_updated_at
before update on public.class_schedule_slots
for each row execute function public.set_updated_at();

alter table public.class_schedule_slots enable row level security;

drop policy if exists "Authorized users can read class schedules" on public.class_schedule_slots;
create policy "Authorized users can read class schedules"
on public.class_schedule_slots for select to authenticated
using (
  exists (
    select 1
    from public.ccb_group_mappings gm
    where gm.id = class_schedule_slots.group_mapping_id
      and public.can_manage_group_session(gm.ccb_group_id)
  )
);

drop policy if exists "Authorized leaders can manage class schedules" on public.class_schedule_slots;
create policy "Authorized leaders can manage class schedules"
on public.class_schedule_slots for all to authenticated
using (
  exists (
    select 1
    from public.ccb_group_mappings gm
    where gm.id = class_schedule_slots.group_mapping_id
      and public.can_manage_group_session(gm.ccb_group_id)
  )
)
with check (
  exists (
    select 1
    from public.ccb_group_mappings gm
    where gm.id = class_schedule_slots.group_mapping_id
      and public.can_manage_group_session(gm.ccb_group_id)
  )
);

alter table public.checkin_sessions
  add column if not exists schedule_slot_id uuid
    references public.class_schedule_slots(id) on delete set null,
  add column if not exists meeting_kind text not null default 'special'
    check (meeting_kind in ('regular', 'special')),
  add column if not exists special_case_note text;

create index if not exists idx_checkin_sessions_schedule_slot
on public.checkin_sessions(schedule_slot_id, occurrence_date);

create unique index if not exists idx_checkin_sessions_one_scheduled_occurrence
on public.checkin_sessions(schedule_slot_id, occurrence_date)
where schedule_slot_id is not null;

create or replace function public.ensure_current_class_session(
  p_public_slug uuid,
  p_now timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mapping public.ccb_group_mappings%rowtype;
  v_slot public.class_schedule_slots%rowtype;
  v_local_date date;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_opens_at timestamptz;
  v_closes_at timestamptz;
  v_occurrence_time time;
  v_session_id uuid;
begin
  select *
  into v_mapping
  from public.ccb_group_mappings
  where public_checkin_slug = p_public_slug
    and enabled = true
    and deleted_at is null
    and ccb_event_id is not null
  limit 1;

  if not found then
    return null;
  end if;

  select slot.*
  into v_slot
  from public.class_schedule_slots slot
  where slot.group_mapping_id = v_mapping.id
    and slot.enabled = true
    and slot.day_of_week =
      extract(dow from (p_now at time zone slot.time_zone))::smallint
    and p_now between
      (
        (
          (p_now at time zone slot.time_zone)::date + slot.start_time
        ) at time zone slot.time_zone
      ) - make_interval(mins => slot.checkin_opens_minutes_before)
      and
      (
        (
          (p_now at time zone slot.time_zone)::date + slot.end_time
        ) at time zone slot.time_zone
      ) + make_interval(mins => slot.checkin_closes_minutes_after)
  order by abs(
    extract(
      epoch from (
        p_now -
        (
          (
            (p_now at time zone slot.time_zone)::date + slot.start_time
          ) at time zone slot.time_zone
        )
      )
    )
  )
  limit 1;

  if not found then
    return null;
  end if;

  v_local_date := (p_now at time zone v_slot.time_zone)::date;
  v_start_at := (v_local_date + v_slot.start_time) at time zone v_slot.time_zone;
  v_end_at := (v_local_date + v_slot.end_time) at time zone v_slot.time_zone;
  v_opens_at := v_start_at - make_interval(mins => v_slot.checkin_opens_minutes_before);
  v_closes_at := v_end_at + make_interval(mins => v_slot.checkin_closes_minutes_after);

  begin
    v_occurrence_time :=
      nullif(v_mapping.default_occurrence_rule ->> 'ccbOccurrenceTime', '')::time;
  exception when others then
    v_occurrence_time := null;
  end;
  v_occurrence_time := coalesce(v_occurrence_time, v_slot.start_time);

  insert into public.checkin_sessions (
    ccb_group_id,
    ccb_event_id,
    title,
    occurrence_date,
    occurrence_start_at,
    occurrence_end_at,
    status,
    checkin_opens_at,
    checkin_closes_at,
    options,
    schedule_slot_id,
    meeting_kind
  )
  values (
    v_mapping.ccb_group_id,
    v_mapping.ccb_event_id,
    v_mapping.group_name || ' Class Meeting',
    v_local_date,
    v_start_at,
    v_end_at,
    'active',
    v_opens_at,
    v_closes_at,
    jsonb_build_object(
      'mapping_id', v_mapping.id,
      'group_name', v_mapping.group_name,
      'ccb_occurrence',
        to_char(v_local_date, 'YYYY-MM-DD') || ' ' ||
        to_char(v_occurrence_time, 'HH24:MI:SS'),
      'event_grouping_id', v_mapping.ccb_event_grouping_id,
      'auto_add_checkins_to_group', v_mapping.auto_add_checkins_to_group,
      'meeting_kind', 'regular'
    ),
    v_slot.id,
    'regular'
  )
  on conflict (schedule_slot_id, occurrence_date)
    where schedule_slot_id is not null
  do update set
    ccb_event_id = excluded.ccb_event_id,
    title = excluded.title,
    occurrence_start_at = excluded.occurrence_start_at,
    occurrence_end_at = excluded.occurrence_end_at,
    checkin_opens_at = excluded.checkin_opens_at,
    checkin_closes_at = excluded.checkin_closes_at,
    options = excluded.options,
    status = case
      when public.checkin_sessions.status = 'cancelled'
        then public.checkin_sessions.status
      else 'active'
    end,
    updated_at = now()
  returning id into v_session_id;

  return v_session_id;
end;
$$;

revoke all on function public.ensure_current_class_session(uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.ensure_current_class_session(uuid, timestamptz)
to service_role;

comment on table public.class_schedule_slots is
  'Weekly day/time rows entered by class leaders. A class may have multiple rows.';
comment on column public.checkin_sessions.meeting_kind is
  'Regular sessions are materialized from a class schedule; special sessions are one-off exceptions.';
