-- Phase 4 Complete MVP additions.
-- Safe to run after 0001 and 0002. Does not modify CCB.

create table if not exists public.public_rate_limits (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null,
  window_start timestamptz not null,
  attempt_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(rate_key, window_start)
);

create index if not exists idx_public_rate_limits_key_window
on public.public_rate_limits(rate_key, window_start desc);

alter table public.public_rate_limits enable row level security;

drop policy if exists "Admins can read public rate limits" on public.public_rate_limits;
create policy "Admins can read public rate limits"
on public.public_rate_limits for select
to authenticated
using (public.is_app_admin());

create index if not exists idx_pending_people_session_status
on public.pending_people(session_id, status);

create index if not exists idx_attendance_checkins_sync_status
on public.attendance_checkins(ccb_sync_status, status);

create index if not exists idx_attendance_checkins_created_desc
on public.attendance_checkins(created_at desc);

create index if not exists idx_audit_logs_target
on public.audit_logs(target_type, target_id, created_at desc);

drop trigger if exists set_public_rate_limits_updated_at on public.public_rate_limits;
create trigger set_public_rate_limits_updated_at
before update on public.public_rate_limits
for each row execute function public.set_updated_at();
