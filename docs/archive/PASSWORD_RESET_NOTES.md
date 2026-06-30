# Password Reset Notes

This patch adds a complete Supabase Auth password-reset flow.

## New pages

```txt
/forgot-password
/reset-password
```

## How it works

1. User opens `/forgot-password`.
2. User enters their admin email.
3. App calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
4. Supabase emails a recovery link.
5. Recovery link returns to `/reset-password`.
6. App exchanges the recovery code for a session when needed.
7. User enters a new password.
8. App calls `supabase.auth.updateUser({ password })`.
9. App signs the user out and sends them back to login.

## Supabase configuration

In Supabase Dashboard:

```txt
Authentication → URL Configuration
```

For local development, allow:

```txt
Site URL: http://localhost:3000
Redirect URLs:
http://localhost:3000/**
```

For production, add your production domain too:

```txt
https://your-domain.com/**
```

## No SQL migration

No database migration is required.
