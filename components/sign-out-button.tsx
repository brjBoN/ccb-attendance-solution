"use client";

import { LogOut } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";

export function SignOutButton({
  dark = false,
  compact = false
}: {
  dark?: boolean;
  compact?: boolean;
}) {
  async function signOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      onClick={signOut}
      aria-label="Sign out"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
        dark
          ? "border-white/15 bg-white/[0.07] text-white/80 hover:bg-white/[0.12] hover:text-white"
          : "border-[#cbd9e7] bg-white text-[#51677f] shadow-sm hover:bg-[#f8fbff]"
      }`}
    >
      <LogOut className="h-4 w-4" />
      <span className={compact ? "sr-only" : "hidden sm:inline"}>Sign out</span>
    </button>
  );
}
