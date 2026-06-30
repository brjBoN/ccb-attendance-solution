# Phase 2 Notes — CCB Client Layer

Phase 2 adds the real server-only CCB service layer.

## Added

- Expanded `lib/ccb/types.ts`
- Robust XML helpers in `lib/ccb/xml.ts`
- Normalizers in `lib/ccb/normalizers.ts`
- Server-only typed `CcbClient` methods
- Privacy-safe public match conversion in `lib/ccb/privacy.ts`
- Admin-only internal API routes:
  - `GET /api/admin/ccb/describe?service=individual_search`
  - `POST /api/admin/ccb/individuals/search`
  - `GET /api/admin/ccb/groups`
  - `GET /api/admin/ccb/events`
- Admin Settings page read-only CCB tools
- Vitest tests with sanitized XML fixtures
- Discovery report script

## Safety

Write services remain blocked unless:

```env
CCB_ENABLE_WRITES=true
```

Person creation remains additionally blocked unless:

```env
CCB_ENABLE_PERSON_CREATION=true
```

Do not enable either until a safe test event/group/person workflow is confirmed.

## Test

```bash
npm install
npm run test
npm run typecheck
npm run dev
```

## Read-only CCB checks

```bash
npm run ccb:describe -- individual_search
npm run ccb:smoke -- --first John --last Smith
npm run ccb:discover
```

`npm run ccb:discover` writes local JSON outputs to:

```txt
tmp/ccb-discovery/
```

That folder is intentionally ignored by Git only if you add it to `.gitignore`.
Do not commit real CCB output unless sanitized.

## Expected next refinement

After you run the read-only tools against the real CCB account, the normalizers may need small adjustments if CCB returns different field names than the generic fixtures. That is expected.


## describe_api behavior

`describe_api=1` requests are allowed even for write-capable service names because they only return service metadata. Actual write calls remain gated.


## Heavy CCB response fix

Some CCB accounts return very large `group_profiles` / `event_profiles` XML payloads. This patch:

- disables XML entity expansion in `fast-xml-parser` with `processEntities: false`
- raises heavier read-call timeouts to 45 seconds
- preserves the safety gates for all write-capable services

If `event_profiles` still times out, Phase 3 should not rely on loading every event at once. Use `describe_api=1` to identify supported filters and search by event name/date/id instead.
