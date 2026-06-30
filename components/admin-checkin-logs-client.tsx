"use client";

import { useState, useTransition } from "react";
import { RefreshCcw } from "lucide-react";

export function RetryCheckinButton({ checkinId }: { checkinId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function retry() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/admin/checkins/${checkinId}/retry`, {
        method: "POST"
      });
      const data = await response.json();
      setMessage(data.message ?? data.error ?? "Retry finished.");
      if (response.ok) {
        window.setTimeout(() => window.location.reload(), 700);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={retry}
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        <RefreshCcw className="h-3 w-3" />
        Retry
      </button>
      {message ? <p className="mt-1 max-w-xs text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}
