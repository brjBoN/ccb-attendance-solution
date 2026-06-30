# v1.1.1 — Weekly CCB Event 500 Fix

This patch addresses a likely `create_event` failure when creating weekly QR sessions.

## Problem

The UI allowed a weekly recurring QR session, but it did not send `recurrence_day_of_week` to CCB. CCB's `create_event` API expects recurrence fields to be submitted as POST form fields and lists `recurrence_day_of_week` as the weekly/monthly day value. In some cases CCB returned HTTP 500 instead of a structured validation message.

## Changes

- For weekly recurrence, the app now derives `recurrence_day_of_week` from the meeting start date when no explicit value is supplied.
- For monthly recurrence, the app derives either the day-of-week or day-of-month from the meeting start date depending on the recurrence mode.
- Event boolean fields are now sent as `1` / `0` instead of `true` / `false`.
- Admin session creation errors now include the truncated CCB response body in the JSON response so future CCB validation failures are easier to diagnose.

## Files changed

- `app/api/admin/sessions/route.ts`
- `lib/ccb/client.ts`

## No migration

No Supabase migration is required.
