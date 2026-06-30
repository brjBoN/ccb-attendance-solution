# Permissions and CCB Checklist — v1.1

## Required migration

Run this file in Supabase SQL Editor after migrations `0001` through `0004`:

```txt
supabase/migrations/0005_permissions_and_ccb_checklist.sql
```

The application reads the new `admin_users.ccb_individual_id` field during login, so apply the migration before starting v1.1.

## Roles

### Owner / Admin

- See every sidebar page.
- Create and edit all CCB groups.
- Create and manage QR sessions for every mapped group.
- View and process pending guests.
- View and complete the CCB checklist.
- View every Supabase Auth user and manage permissions.

### Group Manager

- Can create and edit CCB groups.
- Cannot see Pending Guests, Permissions, or the CCB Checklist.
- Can create/manage QR sessions only when their `CCB individual ID` matches the mapped group's CCB main leader ID.

### Group Leader

- Cannot create or edit CCB groups.
- Can create/manage QR sessions only when their `CCB individual ID` matches the mapped group's CCB main leader ID.
- Cannot see Pending Guests, Permissions, or the CCB Checklist.

### No Access

The Supabase Auth user still exists, but the app authorization row is removed.

## Permissions page

Open:

```txt
/admin/permissions
```

The page uses the Supabase service-role key server-side to display all Supabase Auth users, including users who do not have app access yet.

For each leader or group manager:

1. Assign the role.
2. Enter the person's CCB individual ID.
3. Save.

The CCB individual ID is how the application proves that the signed-in user is the CCB main leader for a mapped group.

## Group main-leader linkage

New CCB groups automatically save `main_leader_id` into the local group mapping.

For existing groups:

1. Open `/admin/groups`.
2. Search the CCB group again.
3. Click **Update mapping**.

The search result includes the CCB main leader ID and refreshes the local mapping.

## QR authorization rule

A QR session can be created or managed only when either:

- the user is an Owner/Admin, or
- the user's `admin_users.ccb_individual_id` equals the group's `ccb_group_mappings.ccb_main_leader_id`.

The rule is checked in the UI, internal API routes, and Supabase RLS policies.

## CCB checklist

Open:

```txt
/admin/checklist
```

Only Owners/Admins can access it.

After a new CCB group is created, the app automatically creates checklist items for CCB web-interface settings that the public API cannot apply, including:

- Attendance groupings
- Leader privileges
- Member privileges
- Participant communication defaults
- Use for Insights
- Join/leave notifications
- Public signup form
- Age range
- Rooms/resources approval group
- Cross-reference saved search
- Inactive status

Each item stores:

- intended value from the create-group form
- instructions
- status
- notes
- whether it is required for QR readiness
- completion user/time

For older mappings, click **Create checklist** on the checklist page. The app uses the most recent group-create audit log when available.
