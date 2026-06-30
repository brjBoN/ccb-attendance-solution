# v1.0 Write-Enabled Completion Notes

This build removes all application feature flags that previously blocked non-destructive CCB writes.

## Enabled without feature flags

- Group creation
- Group updates
- Event creation
- Attendance submission
- Individual creation after admin review
- Add individual to group

## Attendance reliability

The app does not send only the newest person blindly. For every sync it:

1. Reads `attendance_profile` for the exact event occurrence.
2. Reads all local people checked into that session.
3. Deduplicates and merges the two rosters.
4. Uploads a complete `create_event_attendance` XML document through multipart `filedata`.
5. Reads `attendance_profile` again.
6. Marks the session check-ins synced only when verification succeeds.

This protects existing attendance if the CCB write service treats an upload as a full occurrence roster.

## Automatic event creation

When an admin creates a QR session and leaves the event ID empty, the app creates the event in CCB, saves the returned event ID to the local group mapping, and then creates the QR session.

## Guest workflow

Admin approval now attempts the full write workflow:

1. Re-check CCB for a matching person.
2. Create an individual if no match is found.
3. Add the individual to the CCB group.
4. Create a local check-in.
5. Merge and sync event attendance.

Linking to an existing person also attempts group addition and attendance sync.

## Deletion protection

CCB destructive service names are rejected centrally in `lib/ccb/client.ts`.

Local app deletion endpoints require both:

- an admin confirmation dialog
- the request header `x-confirm-delete: confirmed`

## Group updates

The Groups screen links to an edit page for CCB-supported update fields. Inactive status and main-leader replacement are not exposed because those operations are destructive or unsupported by the documented update service.
