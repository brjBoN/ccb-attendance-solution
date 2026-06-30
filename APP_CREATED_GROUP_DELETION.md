# v1.1.3 — App-Created Group Deletion / Cleanup

This feature adds a protected cleanup action for groups created through the app.

## Safety rule

The app will only allow the protected CCB deletion/inactivation workflow for groups that are proven to have been created through the app.

A group qualifies if either:

- `ccb_group_mappings.created_by_app = true`, or
- a successful `ccb_group_create_logs` row exists for the same `ccb_group_id`.

Existing CCB groups that were merely mapped into the app cannot be deleted or inactivated through this workflow.

## What the cleanup does

For an app-created group:

1. Attempts to delete app-created CCB events with `delete_event` if that undocumented service is available.
2. Attempts to delete the CCB group with `delete_group` if that undocumented service is available.
3. Falls back to documented `update_group` with `inactive=1` if `delete_group` is unsupported or denied.
4. Removes local app data tied to that group:
   - QR sessions
   - QR tokens
   - local check-ins
   - pending guest submissions
   - person search logs
   - CCB checklist items
5. Marks the group mapping as deleted/tombstoned instead of physically removing the mapping row.
6. Writes a `ccb_group_deletion_logs` record and an `audit_logs` entry.

## Important CCB limitation

The public CCB API documentation does not list `delete_group` or `delete_event`. It does list `update_group` with an `inactive` parameter. Therefore, the app will attempt true deletion for app-created records, but if CCB does not support it, the app will archive/inactivate the group instead.

## Required migration

Run:

```txt
supabase/migrations/0007_app_created_group_deletion.sql
```

## UI

On `/admin/groups`, full admins will see **Delete app group** for mappings created through the app.

The action requires:

1. a browser confirmation, and
2. typing `DELETE [Group Name]` exactly.

Group Managers can still create groups, but only full Admins/Owners can run the protected app-created deletion workflow.
