"use client";

import { createBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  async function signOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      onClick={signOut}
      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      Sign out
    </button>
  );
}
