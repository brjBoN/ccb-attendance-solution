create table if not exists public.profile_update_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.checkin_sessions(id) on delete set null,
  ccb_individual_id text not null,
  requested_email text,
  requested_mobile_phone text,
  requested_home_phone text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'approved', 'rejected')),
  ticket_jti uuid not null unique,
  processing_started_at timestamptz,
  reviewed_by uuid references public.admin_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_update_requests_has_change check (
    nullif(btrim(requested_email), '') is not null
    or nullif(btrim(requested_mobile_phone), '') is not null
    or nullif(btrim(requested_home_phone), '') is not null
  )
);

create index if not exists idx_profile_update_requests_status_created
on public.profile_update_requests(status, created_at desc);

create index if not exists idx_profile_update_requests_person_created
on public.profile_update_requests(ccb_individual_id, created_at desc);

create unique index if not exists uq_profile_update_requests_active_person
on public.profile_update_requests(ccb_individual_id)
where status in ('pending', 'processing');

drop trigger if exists set_profile_update_requests_updated_at
on public.profile_update_requests;
create trigger set_profile_update_requests_updated_at
before update on public.profile_update_requests
for each row execute function public.set_updated_at();

alter table public.profile_update_requests enable row level security;

drop policy if exists "Full admins can read profile update requests"
on public.profile_update_requests;
create policy "Full admins can read profile update requests"
on public.profile_update_requests for select to authenticated
using (public.is_app_owner_or_admin());

drop policy if exists "Full admins can manage profile update requests"
on public.profile_update_requests;
create policy "Full admins can manage profile update requests"
on public.profile_update_requests for all to authenticated
using (public.is_app_owner_or_admin())
with check (public.is_app_owner_or_admin());

-- Keep this migration self-contained for installations that predate the
-- public rate-limit table but already have the rest of the check-in schema.
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

drop trigger if exists set_public_rate_limits_updated_at
on public.public_rate_limits;
create trigger set_public_rate_limits_updated_at
before update on public.public_rate_limits
for each row execute function public.set_updated_at();

alter table public.public_rate_limits enable row level security;

drop policy if exists "Admins can read public rate limits"
on public.public_rate_limits;
create policy "Admins can read public rate limits"
on public.public_rate_limits for select to authenticated
using (public.is_app_owner_or_admin());

create or replace function public.consume_public_rate_limit(
  p_rate_key text,
  p_window_start timestamptz,
  p_max_attempts integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_count integer;
  retry_at timestamptz;
begin
  if nullif(btrim(p_rate_key), '') is null
    or p_window_start is null
    or p_max_attempts < 1
    or p_window_seconds < 1 then
    raise exception 'Invalid public rate-limit input.';
  end if;

  insert into public.public_rate_limits as rate_limit (
    rate_key,
    window_start,
    attempt_count
  )
  values (
    p_rate_key,
    p_window_start,
    1
  )
  on conflict (rate_key, window_start)
  do update
  set attempt_count = least(
    rate_limit.attempt_count + 1,
    p_max_attempts + 1
  )
  returning rate_limit.attempt_count
  into current_count;

  allowed := current_count <= p_max_attempts;
  remaining := greatest(p_max_attempts - current_count, 0);
  retry_at := p_window_start + make_interval(secs => p_window_seconds);
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      ceil(extract(epoch from retry_at - clock_timestamp()))::integer,
      1
    )
  end;

  return next;
end;
$$;

revoke all on function public.consume_public_rate_limit(
  text,
  timestamptz,
  integer,
  integer
) from public;
revoke all on function public.consume_public_rate_limit(
  text,
  timestamptz,
  integer,
  integer
) from anon;
revoke all on function public.consume_public_rate_limit(
  text,
  timestamptz,
  integer,
  integer
) from authenticated;
grant execute on function public.consume_public_rate_limit(
  text,
  timestamptz,
  integer,
  integer
) to service_role;
