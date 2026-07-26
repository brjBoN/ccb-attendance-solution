"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { safeAuthRedirectPath } from "@/lib/auth/redirect";
import { createBrowserClient } from "@/lib/supabase/client";

export function AuthForm({
  next,
  initialMessage = null
}: {
  next?: string | null;
  initialMessage?: string | null;
}) {
  const supabase = createBrowserClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setMessage(null);

      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");

      if (!email || !password) {
        setMessage("Enter an email and password.");
        return;
      }

      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (result.error) {
        setMessage(result.error.message);
        return;
      }

      if (mode === "signup") {
        setMessage(
          "Account created. Check your email if confirmation is required, then ask an administrator to connect your account."
        );
        return;
      }

      window.location.href = safeAuthRedirectPath(next);
    });
  }

  return (
    <div className="w-full rounded-[28px] border border-[#d7e2ee] bg-white p-6 shadow-[0_24px_70px_rgba(7,31,63,0.1)] sm:p-8">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#0866ff]">
          Admin access
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[#0b1f3a]">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#66798d]">
          {mode === "signin"
            ? "Sign in to change group times, review guests, and manage attendance."
            : "Create a sign-in, then ask an administrator to grant access."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-[#29415d]">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="form-input mt-1.5 py-3"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[#29415d]">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="form-input mt-1.5 py-3"
          />
        </label>

        <button
          disabled={isPending}
          className="w-full rounded-xl bg-[#0866ff] px-4 py-3 font-semibold text-white shadow-[0_10px_25px_rgba(8,102,255,0.18)] transition hover:bg-[#0754d6] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      {message ? (
        <p className="mt-4 rounded-xl bg-[#eef6ff] p-3 text-sm leading-6 text-[#3f5b78]">
          {message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 border-t border-[#e2ebf4] pt-5 text-sm">
        {mode === "signin" ? (
          <Link href="/forgot-password" className="font-semibold text-[#0866ff] hover:underline">
            Forgot password?
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-left font-semibold text-[#0866ff] hover:underline"
        >
          {mode === "signin"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
