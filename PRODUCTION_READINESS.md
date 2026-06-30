# Production Readiness / Deployment Runbook

## 1. CCB API user

Grant the services in `CCB_REQUIRED_SERVICES.md`. CCB permissions are enforced by the CCB API account even though application write feature flags have been removed.

Use a dedicated API user and keep its username/password only in local/Vercel environment variables.

## 2. Supabase

Run migrations 0001 through 0004 in order.

Confirm:

- Row Level Security is enabled
- only approved users appear in `admin_users`
- database backups are enabled
- the service-role/secret key is never exposed in browser code

## 3. Local verification

```bash
npm install
npm run typecheck
npm run test
npm run lint
npm run build
npm run dev
```

Test:

1. Admin login and password reset
2. Group search, creation, and edit
3. Automatic event creation
4. QR generation and token validation
5. Existing-person check-in
6. Duplicate check-in prevention
7. Attendance verification in CCB
8. Guest submission and approval
9. Linked-person group addition and attendance
10. Pending-submission delete confirmation

## 4. Vercel

1. Push the project to a private GitHub repository.
2. Import it into Vercel.
3. Add all `.env.local` values as Vercel environment variables.
4. Set `APP_BASE_URL` to the production HTTPS URL.
5. Deploy.
6. Add the production domain to Supabase Auth redirect URLs.
7. Send a production password-reset email and complete the flow.
8. Scan a production QR code from a phone.

## 5. Operational safeguards

- CCB deletion/removal/inactivation services are blocked centrally.
- Local deletion requires explicit confirmation.
- QR tokens are random and stored as hashes.
- Public endpoints are rate-limited.
- Attendance sync is read-merge-write with read-back verification.
- Guest creation is admin-reviewed and duplicate-checked.
- Every important write is recorded in local audit/log tables.

## 6. Backup and recovery

Before a large rollout:

- confirm Supabase backups
- export a list of group/event mappings
- document the CCB API user and granted services
- retain a rollback deployment in Vercel
- train at least two admins on failed-sync retry and guest review
