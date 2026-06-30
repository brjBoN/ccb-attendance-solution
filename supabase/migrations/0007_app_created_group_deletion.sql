-- v1.1.3: guarded deletion/cleanup for groups created through this app.
-- Run after migrations 0001 through 0006.

alter table public.ccb_group_mappings
  add column if not exists created_by_app boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.admin_users(id) on delete set null,
  add column if not exists ccb_delete_status text,
  add column if not exists ccb_delete_message text;

-- Backfill app-created mappings from successful app create logs.
update public.ccb_group_mappings gm
set created_by_app = true
where exists (
  select 1
  from public.ccb_group_create_logs gl
  where gl.ccb_group_id = gm.ccb_group_id
    and gl.status = 'created'
);

create index if not exists idx_ccb_group_mappings_created_by_app
on public.ccb_group_mappings(created_by_app);

create index if not exists idx_ccb_group_mappings_deleted_at
on public.ccb_group_mappings(deleted_at);

create table if not exists public.ccb_group_deletion_logs (
  id uuid primary key default gen_random_uuid(),
  group_mapping_id uuid references public.ccb_group_mappings(id) on delete set null,
  ccb_group_id text not null,
  group_name text not null,
  requested_by uuid references public.admin_users(id) on delete set null,
  confirmation_text text not null,
  ccb_group_delete_attempted boolean not null default false,
  ccb_group_delete_status text not null default 'not_attempted'
    check (ccb_group_delete_status in ('not_attempted', 'deleted', 'inactivated', 'failed', 'unsupported')),
  ccb_group_delete_message text,
  ccb_event_delete_results jsonb not null default '[]'::jsonb,
  local_delete_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ccb_group_deletion_logs enable row level security;

create index if not exists idx_ccb_group_deletion_logs_group_id
on public.ccb_group_deletion_logs(ccb_group_id);

create index if not exists idx_ccb_group_deletion_logs_created_at
on public.ccb_group_deletion_logs(created_at desc);

drop policy if exists "Full admins can read group deletion logs" on public.ccb_group_deletion_logs;
create policy "Full admins can read group deletion logs"
on public.ccb_group_deletion_logs for select
to authenticated
using (public.is_app_owner_or_admin());
