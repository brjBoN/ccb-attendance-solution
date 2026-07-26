-- Use Heritage's group/leader language in database-generated meeting titles.
-- Custom and special-case meeting titles are intentionally left unchanged.

create or replace function public.ensure_current_class_session(
  p_public_slug uuid,
  p_now timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
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
    v_mapping.group_name || ' Group Meeting',
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
    title = case
      when public.checkin_sessions.title in (
        coalesce(
          public.checkin_sessions.options ->> 'group_name',
          excluded.options ->> 'group_name'
        ) || ' Class Meeting',
        coalesce(
          public.checkin_sessions.options ->> 'group_name',
          excluded.options ->> 'group_name'
        ) || ' Group Meeting'
      )
        then excluded.title
      else public.checkin_sessions.title
    end,
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

update public.checkin_sessions as session
set
  title = mapping.group_name || ' Group Meeting',
  updated_at = now()
from public.class_schedule_slots as slot
join public.ccb_group_mappings as mapping
  on mapping.id = slot.group_mapping_id
where session.schedule_slot_id = slot.id
  and session.meeting_kind = 'regular'
  and session.title =
    coalesce(session.options ->> 'group_name', mapping.group_name)
    || ' Class Meeting';

comment on table public.class_schedule_slots is
  'Weekly day/time rows entered by group leaders. A group may have multiple rows.';
comment on column public.checkin_sessions.meeting_kind is
  'Regular sessions are materialized from a group schedule; special sessions are one-off exceptions.';
