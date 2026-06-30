# v1.1.2 — Attendance Grouping and Group Membership Fix

This release fixes the issue where CCB events created by the app could have `Attendance Grouping: None` and where people who checked in were not added as participants of the CCB group.

## What changed

- QR session creation now includes a **CCB Attendance Grouping** selector.
- When the app creates a new CCB event, it requires and sends `event_grouping_id`.
- Group mappings now store a default CCB attendance grouping ID.
- Group mappings now store whether QR check-ins should automatically add people to the CCB group.
- Public QR check-in now attempts `add_individual_to_group` before/alongside attendance sync.
- The public success message now says whether the person was added to the CCB group, was already in the group, or could not be added.
- Existing-event QR sessions show a warning that the app cannot set the Attendance Grouping on an already-created CCB event.

## Required migration

Run this migration in Supabase SQL Editor:

```txt
supabase/migrations/0006_event_grouping_and_auto_group_membership.sql
```

## Important behavior

If you create a new event automatically from the QR Sessions page, the app now blocks creation until a CCB Attendance Grouping is selected. This prevents CCB from creating the event with `Attendance Grouping: None`.

If you enter an existing CCB event ID, the app cannot change that event's Attendance Grouping. You must confirm the event's Attendance settings directly in CCB.

## Test

1. Run migration `0006`.
2. Open `/admin/groups` and set the default Attendance Grouping for the test group.
3. Make sure “Add QR check-ins to this CCB group as participants” is checked.
4. Open `/admin/sessions`.
5. Create a new weekly QR session with the Attendance Grouping selected.
6. Confirm the created CCB event no longer shows `Attendance Grouping: None`.
7. Check in via QR.
8. Confirm the attendee appears in CCB group participants and event attendance.
