-- Group create audit/log table.
-- Safe to run after earlier migrations. This does not modify CCB.

create table if not exists public.ccb_group_create_logs (
  id uuid primary key default gen_random_uuid(),
  ccb_group_id text,
  group_name text not null,
  created_by uuid references public.admin_users(id) on delete set null,
  request_payload jsonb not null default '{}'::jsonb,
  api_payload jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  status text not null default 'created' check (status in ('created', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.ccb_group_create_logs enable row level security;

drop policy if exists "Admins can read group create logs" on public.ccb_group_create_logs;
create policy "Admins can read group create logs"
on public.ccb_group_create_logs for select
to authenticated
using (public.is_app_admin());

create index if not exists idx_ccb_group_create_logs_created_at
on public.ccb_group_create_logs(created_at desc);

create index if not exists idx_ccb_group_create_logs_ccb_group_id
on public.ccb_group_create_logs(ccb_group_id);
