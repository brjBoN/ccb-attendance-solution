-- Phase 3 optional hardening indexes.
-- Safe to run after 0001. This does not alter CCB or require data deletion.

create index if not exists idx_ccb_group_mappings_enabled
on public.ccb_group_mappings(enabled);

create index if not exists idx_checkin_sessions_group_event_date
on public.checkin_sessions(ccb_group_id, ccb_event_id, occurrence_date);

create index if not exists idx_checkin_tokens_lookup
on public.checkin_tokens(token_hash, revoked_at, expires_at);
