# Patch 0.4.2 — Fix CCB Client Syntax Error

Fixes a malformed insertion in `lib/ccb/client.ts` where `"create_group"` was accidentally inserted inside the `addIndividualToGroup()` request object.

## Changed

- Removed the invalid `"create_group",` line from `addIndividualToGroup()`.
- Kept `create_group` in the write-service allow/gate list.
- Kept the actual `createGroup()` client method intact.

## Safety

No database migration required.

This patch does not change CCB data. It only fixes TypeScript compilation/runtime startup.
