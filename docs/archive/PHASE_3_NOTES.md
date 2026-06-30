# Phase 3 Notes — Admin Group/Session/QR Management

Phase 3 adds local admin workflows:

- Search CCB groups from the admin UI
- Save local group mappings in `ccb_group_mappings`
- Optional/default CCB event ID field per group
- Create local `checkin_sessions`
- Generate secure random QR tokens
- Store only token hashes in `checkin_tokens`
- Return QR code and check-in URL at creation time
- Regenerate QR tokens later, revoking prior active tokens
- Validate public `/checkin/g/[token]` links
- Show active/expired/revoked/closed states on public check-in page

## Safety

This phase does not modify CCB.

The only writes are to Supabase tables owned by this app:

- `ccb_group_mappings`
- `checkin_sessions`
- `checkin_tokens`

CCB writes remain blocked by:

```env
CCB_ENABLE_WRITES=false
CCB_ENABLE_PERSON_CREATION=false
```

## Apply optional migration

Run this in Supabase SQL Editor:

```txt
supabase/migrations/0002_phase3_indexes_and_constraints.sql
```

It only adds indexes.

## Workflow to test

1. Run `npm run typecheck`
2. Run `npm run test`
3. Run `npm run dev`
4. Open `/admin/groups`
5. Search for a CCB group
6. Save a mapping
7. Open `/admin/sessions`
8. Create a session
9. Download/copy the QR
10. Open the generated check-in URL
11. Confirm the public page validates the token and shows the session

## Important QR note

The app stores only token hashes. That means the QR URL is only displayed at creation/regeneration time.

If you lose the QR URL, click "New QR" on the session. This revokes active tokens for that session and generates a new one.
