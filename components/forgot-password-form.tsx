"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const supabase = createBrowserClient();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();

    startTransition(async () => {
      setMessage(null);

      if (!email) {
        setMessage("Enter your email address.");
        return;
      }

      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(
        "If that email exists in Supabase Auth, a password reset email has been sent. Open the link and set a new password."
      );
    });
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950">Reset password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Enter the email used for your admin account. Supabase will email a recovery link. The Reset Password email template must point to /auth/confirm with token_hash as described in PASSWORD_RESET_TOKEN_HASH_NOTES.md.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
          />
        </label>

        <button
          disabled={isPending}
          className="w-full rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Sending..." : "Send reset email"}
        </button>
      </form>

      {message ? (
        <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm leading-6 text-slate-700">
          {message}
        </p>
      ) : null}

      <Link
        href="/login"
        className="mt-5 inline-flex text-sm font-medium text-brand-700 hover:underline"
      >
        Back to login
      </Link>
    </div>
  );
}
