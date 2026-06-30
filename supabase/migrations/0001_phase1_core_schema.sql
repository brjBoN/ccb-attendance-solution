-- CCB QR Attendance Phase 1 core schema
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  email text not null,
  role text not null default 'leader' check (role in ('owner', 'admin', 'leader')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ccb_group_mappings (
  id uuid primary key default gen_random_uuid(),
  ccb_group_id text not null unique,
  group_name text not null,
  ccb_event_id text,
  default_occurrence_rule jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checkin_sessions (
  id uuid primary key default gen_random_uuid(),
  ccb_group_id text not null,
  ccb_event_id text not null,
  title text not null,
  occurrence_date date not null,
  occurrence_start_at timestamptz,
  occurrence_end_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed', 'cancelled')),
  checkin_opens_at timestamptz,
  checkin_closes_at timestamptz,
  options jsonb not null default '{}'::jsonb,
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checkin_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.checkin_sessions(id) on delete cascade,
  token_hash text not null unique,
  label text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_checkins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.checkin_sessions(id) on delete cascade,
  ccb_individual_id text,
  source text not null default 'qr' check (source in ('qr', 'admin', 'guest_approval', 'retry')),
  status text not null default 'pending' check (status in ('pending', 'success', 'duplicate', 'failed', 'needs_review')),
  ccb_sync_status text not null default 'not_synced' check (ccb_sync_status in ('not_synced', 'synced', 'failed', 'skipped')),
  ccb_synced_at timestamptz,
  idempotency_key text not null,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, idempotency_key)
);

create unique index if not exists attendance_checkins_unique_person_per_session
on public.attendance_checkins (session_id, ccb_individual_id)
where ccb_individual_id is not null and status in ('pending', 'success');

create table if not exists public.person_search_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.checkin_sessions(id) on delete set null,
  normalized_first_name text,
  normalized_last_name text,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.pending_people (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.checkin_sessions(id) on delete set null,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'linked')),
  linked_ccb_individual_id text,
  created_ccb_individual_id text,
  reviewed_by uuid references public.admin_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('system', 'admin', 'public')),
  actor_id text,
  action text not null,
  target_type text,
  target_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_checkin_sessions_status
on public.checkin_sessions(status);

create index if not exists idx_checkin_tokens_session_id
on public.checkin_tokens(session_id);

create index if not exists idx_attendance_checkins_session_id
on public.attendance_checkins(session_id);

create index if not exists idx_pending_people_status
on public.pending_people(status);

create index if not exists idx_audit_logs_created_at
on public.audit_logs(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_admin_users_updated_at on public.admin_users;
create trigger set_admin_users_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

drop trigger if exists set_ccb_group_mappings_updated_at on public.ccb_group_mappings;
create trigger set_ccb_group_mappings_updated_at
before update on public.ccb_group_mappings
for each row execute function public.set_updated_at();

drop trigger if exists set_checkin_sessions_updated_at on public.checkin_sessions;
create trigger set_checkin_sessions_updated_at
before update on public.checkin_sessions
for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;
alter table public.admin_users enable row level security;
alter table public.ccb_group_mappings enable row level security;
alter table public.checkin_sessions enable row level security;
alter table public.checkin_tokens enable row level security;
alter table public.attendance_checkins enable row level security;
alter table public.person_search_logs enable row level security;
alter table public.pending_people enable row level security;
alter table public.audit_logs enable row level security;

-- Admin helper. SECURITY DEFINER allows policies to check membership without recursive RLS failure.
create or replace function public.is_app_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where auth_user_id = auth.uid()
      and role in ('owner', 'admin', 'leader')
  );
$$;

create or replace function public.is_app_owner_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where auth_user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- Policies are intentionally conservative for Phase 1.
-- Server-side service role can bypass RLS. Authenticated app admins can read dashboard data.

drop policy if exists "Admins can read app settings" on public.app_settings;
create policy "Admins can read app settings"
on public.app_settings for select
to authenticated
using (public.is_app_admin());

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users for select
to authenticated
using (public.is_app_admin());

drop policy if exists "Owners/admins can manage admin users" on public.admin_users;
create policy "Owners/admins can manage admin users"
on public.admin_users for all
to authenticated
using (public.is_app_owner_or_admin())
with check (public.is_app_owner_or_admin());

drop policy if exists "Admins can read group mappings" on public.ccb_group_mappings;
create policy "Admins can read group mappings"
on public.ccb_group_mappings for select
to authenticated
using (public.is_app_admin());

drop policy if exists "Owners/admins can manage group mappings" on public.ccb_group_mappings;
create policy "Owners/admins can manage group mappings"
on public.ccb_group_mappings for all
to authenticated
using (public.is_app_owner_or_admin())
with check (public.is_app_owner_or_admin());

drop policy if exists "Admins can read checkin sessions" on public.checkin_sessions;
create policy "Admins can read checkin sessions"
on public.checkin_sessions for select
to authenticated
using (public.is_app_admin());

drop policy if exists "Owners/admins can manage checkin sessions" on public.checkin_sessions;
create policy "Owners/admins can manage checkin sessions"
on public.checkin_sessions for all
to authenticated
using (public.is_app_owner_or_admin())
with check (public.is_app_owner_or_admin());

drop policy if exists "Admins can read checkin tokens" on public.checkin_tokens;
create policy "Admins can read checkin tokens"
on public.checkin_tokens for select
to authenticated
using (public.is_app_admin());

drop policy if exists "Owners/admins can manage checkin tokens" on public.checkin_tokens;
create policy "Owners/admins can manage checkin tokens"
on public.checkin_tokens for all
to authenticated
using (public.is_app_owner_or_admin())
with check (public.is_app_owner_or_admin());

drop policy if exists "Admins can read attendance checkins" on public.attendance_checkins;
create policy "Admins can read attendance checkins"
on public.attendance_checkins for select
to authenticated
using (public.is_app_admin());

drop policy if exists "Admins can read person search logs" on public.person_search_logs;
create policy "Admins can read person search logs"
on public.person_search_logs for select
to authenticated
using (public.is_app_admin());

drop policy if exists "Admins can read pending people" on public.pending_people;
create policy "Admins can read pending people"
on public.pending_people for select
to authenticated
using (public.is_app_admin());

drop policy if exists "Owners/admins can manage pending people" on public.pending_people;
create policy "Owners/admins can manage pending people"
on public.pending_people for all
to authenticated
using (public.is_app_owner_or_admin())
with check (public.is_app_owner_or_admin());

drop policy if exists "Admins can read audit logs" on public.audit_logs;
create policy "Admins can read audit logs"
on public.audit_logs for select
to authenticated
using (public.is_app_admin());
