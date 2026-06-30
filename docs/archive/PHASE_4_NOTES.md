# Phase 4 Notes — Public Existing-Person Check-In

Phase 4 adds the public attendee flow for existing CCB people.

## Added

- Public QR page now displays a real check-in form
- First/last name search
- Optional phone/email narrowing
- Server-side CCB individual search
- Privacy-safe match cards
- Attendee profile selection
- Duplicate local check-in prevention
- Local `attendance_checkins` logging
- Admin logs page showing recent check-ins
- CCB sync gating based on `CCB_ENABLE_WRITES`

## Safety

With the recommended env setting:

```env
CCB_ENABLE_WRITES=false
```

submitting the public form does **not** write to CCB.

It writes only to the local Supabase `attendance_checkins` table with:

```txt
status = success
ccb_sync_status = skipped
```

The UI tells the attendee that check-in was recorded locally but not synced to CCB yet.

If `CCB_ENABLE_WRITES=true`, the submit route attempts `create_event_attendance`.
Do not enable this until you have permission and a safe test event.

## Test workflow

1. Ensure `.env.local` has `CCB_ENABLE_WRITES=false`
2. Run `npm run typecheck`
3. Run `npm run test`
4. Run `npm run dev`
5. Open `/admin/sessions`
6. Create or use an existing QR session
7. Open the generated QR URL
8. Search for a known CCB person
9. Select the correct privacy-safe match
10. Confirm success says local-only / CCB sync disabled
11. Open `/admin/logs`
12. Confirm the check-in appears with sync status `skipped`

## Not included yet

- Guest/new-person capture
- Admin approval queue
- Attendance retry to CCB
- Append-vs-replace safety verification for `create_event_attendance`
- Rate limiting/CAPTCHA
