# v1.2.0 — Permanent Class QR Links and Visual Redesign

## What changed

Attendance is still separated into dated meeting records, but the public QR
code now belongs to the class instead of the meeting.

- Every enabled class receives one stable, opaque `public_checkin_slug`.
- The public class link looks up the meeting currently open for attendance.
- Opening a meeting closes any previously open meeting for the same class.
- Creating a meeting does not insert a `checkin_tokens` row.
- Reopening a meeting does not rotate or replace the class link.
- Existing meeting-token URLs remain valid so old printed codes do not fail
  immediately during rollout.

## Required database migration

Run this migration after `0007_app_created_group_deletion.sql`:

```txt
supabase/migrations/0008_persistent_class_checkin_links.sql
```

The migration:

1. Adds `public_checkin_slug` to `ccb_group_mappings`.
2. Backfills a random UUID for every existing mapped class.
3. Makes the value required for future mappings.
4. Adds a unique index for fast and unambiguous public lookup.

## New leader workflow

1. Open **Classes** and confirm the CCB group is enabled.
2. Open **Class check-in**.
3. Select the class and download or copy its permanent QR code.
4. Print or share that code once.
5. At each meeting, set the attendance window and choose **Open meeting**.
6. Members scan the same class QR code and mark themselves present.
7. Close the meeting when attendance is finished, or let the configured
   check-in close time pause the link.

## Public-link behavior

- If a meeting is open, the link displays that meeting and allows check-in.
- If the next meeting has not opened, the member sees a friendly "not open
  yet" message.
- If no meeting is open, the member is told that the QR code is still correct
  and can be scanned again when class begins.
- If multiple legacy active meetings exist, the app chooses the open meeting
  whose start time is closest to the current time.

## Visual redesign

The release introduces a responsive forest, mint, ivory, and amber visual
system across:

- Public landing page
- Leader sign-in
- Admin navigation
- Attendance dashboard
- Classes
- Class check-in workspace
- Public mobile check-in

The new class workspace gives the permanent QR code a fixed, prominent panel
and separates it visually from the dated meeting controls.

## Rollout verification

After deploying the migration and application:

1. Select two existing classes and confirm each has a different permanent link.
2. Open a meeting for the first class.
3. Scan its QR code from a phone and complete a test check-in.
4. Close the meeting and confirm the same link reports that no meeting is open.
5. Open a new meeting for the same class and confirm the original link now
   reaches the new meeting.
6. Confirm the attendance record is associated with the new meeting and
   synchronizes to the expected CCB event occurrence.
