# Patch 0.4.1 — Delete Rejected Guest Submissions

Change requested:

- Rejected new-person/guest submissions should be deleted.
- They should no longer remain visible on the Pending Guests page.
- Admin should see an “Are you sure?” confirmation before deletion.

## Changed

- The Pending Guests “Reject” button is now labeled “Delete.”
- Clicking it opens a browser confirmation dialog.
- If confirmed, the backend deletes the `pending_people` row.
- A minimal audit log entry is still written.
- The Pending Guests page filters to pending submissions only.

## Safety

This only affects the local Supabase `pending_people` table.

It does not modify CCB.
