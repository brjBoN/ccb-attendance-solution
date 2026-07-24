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
    <div className="w-full rounded-[28px] border border-[#d9ddd7] bg-white p-6 shadow-[0_24px_70px_rgba(24,45,39,0.1)] sm:p-8">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#167365]">
          Leader access
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[#18332d]">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#6d7b76]">
          {mode === "signin"
            ? "Sign in to open meetings and manage class attendance."
            : "Create a sign-in, then ask an administrator to grant your class access."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-[#38534c]">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="form-input mt-1.5 py-3"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[#38534c]">Password</span>
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
          className="w-full rounded-xl bg-[#167365] px-4 py-3 font-semibold text-white shadow-[0_10px_25px_rgba(22,115,101,0.18)] transition hover:bg-[#0f6156] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      {message ? (
        <p className="mt-4 rounded-xl bg-[#eef5f1] p-3 text-sm leading-6 text-[#456159]">
          {message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 border-t border-[#e5e8e3] pt-5 text-sm">
        {mode === "signin" ? (
          <Link href="/forgot-password" className="font-semibold text-[#167365] hover:underline">
            Forgot password?
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-left font-semibold text-[#167365] hover:underline"
        >
          {mode === "signin"
            ? "Need to create the first Auth user?"
            : "Already created the Auth user? Sign in"}
        </button>
      </div>
    </div>
  );
}
