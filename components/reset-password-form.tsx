"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const supabase = createBrowserClient();
  const [isReady, setIsReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [message, setMessage] = useState<string | null>("Checking recovery session...");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function checkRecoverySession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        if (!isMounted) return;
        setHasSession(false);
        setIsReady(true);
        setMessage(
          "This reset link is using Supabase's PKCE code flow, but this app now expects the token-hash recovery link. Update the Supabase Reset Password email template as described in PASSWORD_RESET_TOKEN_HASH_NOTES.md, then request a new reset email."
        );
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error) {
        setHasSession(false);
        setMessage(error.message);
      } else if (data.session) {
        setHasSession(true);
        setMessage("Enter a new password below.");
      } else {
        setHasSession(false);
        setMessage(
          "No active recovery session was found. The reset link may be expired, already used, or still using the old email template. Request a new reset email after updating the template."
        );
      }

      setIsReady(true);
    }

    void checkRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    startTransition(async () => {
      setMessage(null);

      if (password.length < 8) {
        setMessage("Use at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setMessage("The passwords do not match.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage(error.message);
        return;
      }

      await supabase.auth.signOut();
      setHasSession(false);
      setMessage("Password updated. You can now sign in with your new password.");
    });
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950">Set new password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This page completes the Supabase recovery email flow.
        </p>
      </div>

      {hasSession ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">New password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Confirm new password</span>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
            />
          </label>

          <button
            disabled={isPending || !isReady}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Updating..." : "Update password"}
          </button>
        </form>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm leading-6 text-slate-700">
          {message}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 text-sm">
        <Link href="/forgot-password" className="font-medium text-brand-700 hover:underline">
          Request another reset email
        </Link>
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}
