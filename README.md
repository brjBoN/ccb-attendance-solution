# CCB QR Small Group Attendance — v1.0

A Next.js web app for managing CCB small groups, generating secure QR check-in sessions, finding existing CCB people, creating reviewed guest profiles, and synchronizing attendance back to Pushpay/CCB.

## Current behavior

All implemented **non-destructive CCB writes are active by default**. No `CCB_ENABLE_*` feature flags are required.

Implemented CCB writes:

- Create groups with `create_group`
- Update supported group fields with `update_group`
- Create one-time or recurring events with `create_event`
- Submit attendance with `create_event_attendance`
- Create approved new-person profiles with `create_individual`
- Add approved or linked people to groups with `add_individual_to_group`

CCB delete/remove/inactivate/deactivate services are blocked in `CcbClient`. Local app deletions require an explicit confirmation dialog and confirmation header.

## Main workflows

### Group administration

- Search CCB groups
- Create a real CCB group
- Automatically save newly-created groups as local QR mappings
- Edit supported CCB group fields
- Enable/disable local QR mappings
- Deletion of a local mapping requires confirmation and does not delete the CCB group

### QR sessions and events

- Create a QR session for a mapped group
- Enter an existing CCB event ID, or leave it blank to create the CCB event automatically
- Create recurring CCB events
- Set occurrence, meeting, and check-in windows
- Generate secure random QR tokens
- Store token hashes rather than raw tokens
- Revoke/regenerate QR tokens

### Existing-person check-in

- Validate QR token/session/window
- Search CCB by name and optional phone/email
- Return privacy-masked match cards
- Prevent duplicate local check-ins
- Read the current CCB attendance roster
- Merge current CCB attendees with local check-ins
- Upload the complete merged XML roster
- Read the roster back and verify the attendees were saved

### Guest/new-person workflow

- Public “I don’t see myself / I’m new” form
- Store pending request in Supabase
- Admin searches for possible existing CCB profiles
- Admin can link to an existing person or create a new CCB individual
- Linked/created person is added to the CCB group
- Attendance is submitted to CCB
- Deleting a pending submission requires confirmation

### Administration and operations

- Supabase Auth admin login
- Forgot/reset password flow using token-hash verification
- Admin dashboard and metrics
- Session detail dashboards
- Check-in and sync logs
- Manual attendance retry
- Audit logs
- Public endpoint rate limiting

## Requirements

- Node.js 20 or newer
- A hosted Supabase project
- A CCB API user with the services listed in `CCB_REQUIRED_SERVICES.md`

## Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Required values:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

CCB_API_URL=https://heritagelife.ccbchurch.com/api.php
CCB_API_USERNAME=
CCB_API_PASSWORD=

APP_BASE_URL=http://localhost:3000

PUBLIC_RATE_LIMIT_WINDOW_SECONDS=60
PUBLIC_RATE_LIMIT_MAX_ATTEMPTS=20
```

Never commit `.env.local`.

## Supabase migrations

Run these in order in Supabase SQL Editor:

```txt
supabase/migrations/0001_phase1_core_schema.sql
supabase/migrations/0002_phase3_indexes_and_constraints.sql
supabase/migrations/0003_phase4_complete_mvp.sql
supabase/migrations/0004_group_create_logs.sql
```

## First admin

Create/confirm the user through Supabase Auth, then run this in SQL Editor with the correct email:

```sql
insert into public.admin_users (auth_user_id, email, name, role)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'name', email),
  'owner'
from auth.users
where lower(email) = lower('YOUR_EMAIL_HERE')
on conflict (auth_user_id) do update
set role = excluded.role,
    email = excluded.email,
    name = excluded.name,
    updated_at = now();
```

## Run locally

```bash
npm install
npm run typecheck
npm run test
npm run lint
npm run dev
```

Open:

```txt
http://localhost:3000/login
```

## Password-reset configuration

In Supabase:

```txt
Authentication → Email Templates → Reset Password
```

Use:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset Password</a>
```

For local Auth URL configuration:

```txt
Site URL: http://localhost:3000
Redirect URLs: http://localhost:3000/**
```

## CCB deletion policy

The client rejects CCB service names that indicate deletion, removal, inactivation, or deactivation. It also explicitly rejects:

```txt
remove_individual_from_group
individual_inactivate
update_group with inactive=true
```

The app does not provide a CCB group-delete action.

## Deployment

See `PRODUCTION_READINESS.md` for Vercel and Supabase deployment steps.

## v1.1 permissions and CCB checklist

Run the new migration before starting this version:

```txt
supabase/migrations/0005_permissions_and_ccb_checklist.sql
```

New admin-only pages:

```txt
/admin/permissions
/admin/checklist
```

Role summary:

- `owner` / `admin`: all pages and all groups
- `group_manager`: can create/edit groups; no Pending Guests, Permissions, or CCB Checklist
- `leader`: QR sessions only for groups they lead

For Group Managers and Group Leaders, set their CCB individual ID on the Permissions page. QR session authorization compares that ID with the group's saved CCB main leader ID.

See `PERMISSIONS_AND_CHECKLIST.md` for setup and behavior details.


## v1.1.1 — Weekly CCB event fix

Fixed a likely CCB `create_event` HTTP 500 when creating weekly QR sessions by deriving `recurrence_day_of_week` from the meeting start date and sending event booleans as `1` / `0`. No migration required.


## v1.1.2 — Attendance grouping and group membership fix

This release adds `event_grouping_id` support for automatically-created CCB events and auto-adds QR check-ins to the mapped CCB group as participants.

Run the new migration:

```txt
supabase/migrations/0006_event_grouping_and_auto_group_membership.sql
```

See `CCB_ATTENDANCE_GROUPING_AND_GROUP_MEMBERSHIP_FIX.md`.

## v1.1.3 — App-created group deletion / cleanup

Run migration:

```txt
supabase/migrations/0007_app_created_group_deletion.sql
```

Full admins can now delete/inactivate only CCB groups created through this app. Existing CCB groups that were only mapped into the app cannot be deleted or inactivated through this workflow.

See `APP_CREATED_GROUP_DELETION.md`.
