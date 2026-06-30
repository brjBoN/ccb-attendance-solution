# Changelog

## 1.0.0-write-enabled

- Removed all `CCB_ENABLE_*` write feature flags.
- Enabled all implemented non-destructive CCB writes.
- Added automatic CCB event creation from the QR session screen.
- Implemented attendance read-merge-write and verification.
- Enabled reviewed individual creation and group addition.
- Added CCB group editing for supported fields.
- Added central CCB destructive-service blocking.
- Retained confirmation-protected local deletion.
- Added attendance XML and documented-response tests.

## 1.1.0 — Permissions and CCB Checklist

- Added `group_manager` role.
- Added admin-only Permissions page listing all Supabase Auth users.
- Added CCB individual ID linkage for app users.
- Added main-leader linkage to CCB group mappings.
- Limited QR session creation/management to full admins or the mapped CCB main leader.
- Added admin-only CCB setup checklist for unsupported group settings.
- Automatically creates checklist items after CCB group creation.
- Added checklist initialization for existing group mappings.
- Restricted Pending Guests and related APIs to full admins.
- Added role-aware sidebar and dashboard.
