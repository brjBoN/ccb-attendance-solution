-- v1.2.0: one reusable public check-in link per mapped class/group.
-- Run after migrations 0001 through 0007.

alter table public.ccb_group_mappings
  add column if not exists public_checkin_slug uuid default gen_random_uuid();

update public.ccb_group_mappings
set public_checkin_slug = gen_random_uuid()
where public_checkin_slug is null;

alter table public.ccb_group_mappings
  alter column public_checkin_slug set default gen_random_uuid(),
  alter column public_checkin_slug set not null;

create unique index if not exists idx_ccb_group_mappings_public_checkin_slug
on public.ccb_group_mappings(public_checkin_slug);

comment on column public.ccb_group_mappings.public_checkin_slug is
  'Stable opaque public identifier used by the reusable class QR code. It is not regenerated for each meeting.';
