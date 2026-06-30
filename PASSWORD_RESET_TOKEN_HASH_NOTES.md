# Password Reset Token-Hash Patch

The earlier password reset page failed with:

```txt
PKCE code verifier not found in storage
```

That happens when Supabase sends a PKCE `code` link, but the stored code verifier is not available when the link is opened. Supabase documents that PKCE exchanges require both the URL code and a locally stored verifier, which means the exchange must happen from the same browser/device/storage where the flow was started.

This patch uses Supabase's SSR-friendly `token_hash` email-link pattern instead.

## App route added

```txt
/auth/confirm
```

It accepts:

```txt
/auth/confirm?token_hash=...&type=recovery&next=/reset-password
```

The route calls:

```ts
supabase.auth.verifyOtp({ token_hash, type: "recovery" })
```

That establishes the recovery session in cookies and redirects to `/reset-password`.

## Required Supabase Email Template change

Go to:

```txt
Supabase Dashboard
→ Authentication
→ Email Templates
→ Reset Password
```

Replace the reset link in the template with this link:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset Password</a>
```

A full minimal template can be:

```html
<h2>Reset your password</h2>

<p>Use this link to reset your password:</p>

<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">
    Reset Password
  </a>
</p>
```

## URL configuration

For local development:

```txt
Site URL:
http://localhost:3000

Redirect URLs:
http://localhost:3000/**
```

For production, add your production URL too.

## Test

1. Restart the dev server.
2. Open `/forgot-password`.
3. Send yourself a new reset email.
4. Click the new reset link.
5. It should go through `/auth/confirm` and then land on `/reset-password`.
6. Enter a new password.
7. Sign in at `/login`.

Old emails that contain `?code=...` will still fail. Request a new reset email after updating the template.
