# Phase 4 Complete MVP Notes

This build combines the remaining handoff phases into one testable MVP while keeping all risky CCB write operations gated.

## Included

- Existing-person public QR check-in
- Guest/new-person public submission
- Admin pending guest review
- Link guest to existing CCB person
- Reject guest
- Gated CCB person creation
- Gated add-to-group
- Gated attendance sync
- Local check-in logs
- Retry sync controls
- Session detail dashboard
- Basic public endpoint rate limiting
- Audit logs
- Production readiness docs

## Required SQL

Run this migration after the earlier migrations:

```txt
supabase/migrations/0003_phase4_complete_mvp.sql
```

## Safe test mode

Use:

```env
CCB_ENABLE_WRITES=false
CCB_ENABLE_PERSON_CREATION=false
CCB_ENABLE_GROUP_ADD=false
```

In this mode:

- existing-person check-ins are stored locally
- guest submissions are stored locally
- retry buttons do not write to CCB
- create-person buttons refuse to run
- no CCB records are changed

## Later testing phases

The next work should be focused on testing and only implementing the items that cannot be safely assumed:

1. Confirm CCB attendance write behavior.
2. Confirm exact group/event/occurrence mapping.
3. Confirm guest creation fields/policy.
4. Confirm whether add-to-group should happen.
5. Production deployment and pilot group UAT.
