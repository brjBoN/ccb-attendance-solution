-- v1.1.2: attendance/event grouping defaults and automatic CCB group membership on check-in.
-- Run after migrations 0001 through 0005.

alter table public.ccb_group_mappings
  add column if not exists ccb_event_grouping_id text,
  add column if not exists auto_add_checkins_to_group boolean not null default true;

create index if not exists idx_ccb_group_mappings_event_grouping
on public.ccb_group_mappings(ccb_event_grouping_id);

-- Existing mappings should default to adding QR check-ins to the group unless explicitly changed later.
update public.ccb_group_mappings
set auto_add_checkins_to_group = true
where auto_add_checkins_to_group is null;
