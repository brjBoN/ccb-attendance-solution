# Patch 0.4.3 — Enable CCB Group Creation by Default

Requested change: make actual CCB group creation enabled by default.

## Changed

- `CCB_ENABLE_GROUP_CREATE` now defaults to `true`.
- `.env.example` now shows `CCB_ENABLE_GROUP_CREATE=true`.
- `create_group` no longer requires the global `CCB_ENABLE_WRITES=true` flag.
- The group creation API route checks only `CCB_ENABLE_GROUP_CREATE`.
- Attendance writes, person creation, and add-to-group remain separately gated:
  - `CCB_ENABLE_WRITES=false`
  - `CCB_ENABLE_PERSON_CREATION=false`
  - `CCB_ENABLE_GROUP_ADD=false`

## Why

The global `CCB_ENABLE_WRITES` flag was blocking group creation. This patch makes group creation its own explicit write category.

## Disable group creation

Set:

```env
CCB_ENABLE_GROUP_CREATE=false
```

Then restart the dev server.
