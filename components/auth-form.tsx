"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function AuthForm() {
  const supabase = createBrowserClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState<string | null>(null);
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
          "Account created. If email confirmation is enabled, confirm your email before signing in. Then seed yourself into admin_users."
        );
        return;
      }

      window.location.href = "/admin";
    });
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950">
          {mode === "signin" ? "Admin sign in" : "Create admin auth user"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Supabase Auth handles sign-in. App admin access is controlled by the
          <code className="mx-1 rounded bg-slate-100 px-1 py-0.5">admin_users</code>
          table.
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

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
          />
        </label>

        <button
          disabled={isPending}
          className="w-full rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      {message ? (
        <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm leading-6 text-slate-700">
          {message}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 text-sm">
        {mode === "signin" ? (
          <Link href="/forgot-password" className="font-medium text-brand-700 hover:underline">
            Forgot password?
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-left font-medium text-brand-700 hover:underline"
        >
          {mode === "signin"
            ? "Need to create the first Auth user?"
            : "Already created the Auth user? Sign in"}
        </button>
      </div>
    </div>
  );
}
