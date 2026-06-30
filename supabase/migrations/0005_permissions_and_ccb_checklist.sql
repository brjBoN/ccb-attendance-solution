-- v1.1: application permissions, CCB leader linkage, and post-create CCB setup checklist.
-- Run after migrations 0001 through 0004.

alter table public.admin_users add column if not exists ccb_individual_id text;
alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check
  check (role in ('owner', 'admin', 'group_manager', 'leader'));

create unique index if not exists idx_admin_users_ccb_individual_id
on public.admin_users(ccb_individual_id) where ccb_individual_id is not null;

alter table public.ccb_group_mappings add column if not exists ccb_main_leader_id text;
create index if not exists idx_ccb_group_mappings_main_leader
on public.ccb_group_mappings(ccb_main_leader_id);

create table if not exists public.ccb_group_setup_checklist (
  id uuid primary key default gen_random_uuid(),
  group_mapping_id uuid not null references public.ccb_group_mappings(id) on delete cascade,
  ccb_group_id text not null,
  checklist_key text not null,
  label text not null,
  intended_value jsonb not null default '{}'::jsonb,
  instructions text not null,
  status text not null default 'pending'
    check (status in ('pending', 'complete', 'not_applicable', 'needs_review')),
  required_for_qr boolean not null default false,
  sort_order integer not null default 0,
  notes text,
  completed_by uuid references public.admin_users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(group_mapping_id, checklist_key)
);

create index if not exists idx_group_setup_checklist_mapping
on public.ccb_group_setup_checklist(group_mapping_id, sort_order);
create index if not exists idx_group_setup_checklist_status
on public.ccb_group_setup_checklist(status);

drop trigger if exists set_ccb_group_setup_checklist_updated_at on public.ccb_group_setup_checklist;
create trigger set_ccb_group_setup_checklist_updated_at
before update on public.ccb_group_setup_checklist
for each row execute function public.set_updated_at();

alter table public.ccb_group_setup_checklist enable row level security;

create or replace function public.is_app_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users
    where auth_user_id = auth.uid()
      and role in ('owner', 'admin', 'group_manager', 'leader')
  );
$$;

create or replace function public.is_app_owner_or_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users
    where auth_user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create or replace function public.can_create_groups()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users
    where auth_user_id = auth.uid()
      and role in ('owner', 'admin', 'group_manager')
  );
$$;

create or replace function public.can_manage_group_session(target_ccb_group_id text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1
    from public.admin_users au
    left join public.ccb_group_mappings gm on gm.ccb_group_id = target_ccb_group_id
    where au.auth_user_id = auth.uid()
      and (
        au.role in ('owner', 'admin')
        or (
          au.role in ('group_manager', 'leader')
          and au.ccb_individual_id is not null
          and gm.ccb_main_leader_id = au.ccb_individual_id
        )
      )
  );
$$;

drop policy if exists "Admins can read admin users" on public.admin_users;
drop policy if exists "Users can read own admin row or full admins can read all" on public.admin_users;
create policy "Users can read own admin row or full admins can read all"
on public.admin_users for select to authenticated
using (auth_user_id = auth.uid() or public.is_app_owner_or_admin());

drop policy if exists "Owners/admins can manage group mappings" on public.ccb_group_mappings;
drop policy if exists "Group creators can manage group mappings" on public.ccb_group_mappings;
create policy "Owners/admins can manage group mappings"
on public.ccb_group_mappings for all to authenticated
using (public.is_app_owner_or_admin()) with check (public.is_app_owner_or_admin());

drop policy if exists "Owners/admins can manage checkin sessions" on public.checkin_sessions;
drop policy if exists "Authorized leaders can manage checkin sessions" on public.checkin_sessions;
create policy "Authorized leaders can manage checkin sessions"
on public.checkin_sessions for all to authenticated
using (public.can_manage_group_session(ccb_group_id))
with check (public.can_manage_group_session(ccb_group_id));

drop policy if exists "Owners/admins can manage checkin tokens" on public.checkin_tokens;
drop policy if exists "Authorized leaders can manage checkin tokens" on public.checkin_tokens;
create policy "Authorized leaders can manage checkin tokens"
on public.checkin_tokens for all to authenticated
using (
  exists (
    select 1 from public.checkin_sessions s
    where s.id = checkin_tokens.session_id
      and public.can_manage_group_session(s.ccb_group_id)
  )
)
with check (
  exists (
    select 1 from public.checkin_sessions s
    where s.id = checkin_tokens.session_id
      and public.can_manage_group_session(s.ccb_group_id)
  )
);

drop policy if exists "Admins can read pending people" on public.pending_people;
drop policy if exists "Full admins can read pending people" on public.pending_people;
create policy "Full admins can read pending people"
on public.pending_people for select to authenticated
using (public.is_app_owner_or_admin());

drop policy if exists "Owners/admins can manage pending people" on public.pending_people;
drop policy if exists "Full admins can manage pending people" on public.pending_people;
create policy "Full admins can manage pending people"
on public.pending_people for all to authenticated
using (public.is_app_owner_or_admin()) with check (public.is_app_owner_or_admin());

drop policy if exists "Full admins can manage CCB setup checklist" on public.ccb_group_setup_checklist;
create policy "Full admins can manage CCB setup checklist"
on public.ccb_group_setup_checklist for all to authenticated
using (public.is_app_owner_or_admin()) with check (public.is_app_owner_or_admin());

-- Restrict session/check-in visibility to full admins or the CCB main leader for that group.
drop policy if exists "Admins can read checkin sessions" on public.checkin_sessions;
drop policy if exists "Authorized users can read checkin sessions" on public.checkin_sessions;
create policy "Authorized users can read checkin sessions"
on public.checkin_sessions for select to authenticated
using (public.can_manage_group_session(ccb_group_id));

drop policy if exists "Admins can read checkin tokens" on public.checkin_tokens;
drop policy if exists "Authorized users can read checkin tokens" on public.checkin_tokens;
create policy "Authorized users can read checkin tokens"
on public.checkin_tokens for select to authenticated
using (
  exists (
    select 1 from public.checkin_sessions s
    where s.id = checkin_tokens.session_id
      and public.can_manage_group_session(s.ccb_group_id)
  )
);

drop policy if exists "Admins can read attendance checkins" on public.attendance_checkins;
drop policy if exists "Authorized users can read attendance checkins" on public.attendance_checkins;
create policy "Authorized users can read attendance checkins"
on public.attendance_checkins for select to authenticated
using (
  exists (
    select 1 from public.checkin_sessions s
    where s.id = attendance_checkins.session_id
      and public.can_manage_group_session(s.ccb_group_id)
  )
);

drop policy if exists "Admins can read person search logs" on public.person_search_logs;
drop policy if exists "Authorized users can read person search logs" on public.person_search_logs;
create policy "Authorized users can read person search logs"
on public.person_search_logs for select to authenticated
using (
  session_id is null
  or exists (
    select 1 from public.checkin_sessions s
    where s.id = person_search_logs.session_id
      and public.can_manage_group_session(s.ccb_group_id)
  )
);
