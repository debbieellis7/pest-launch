"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Restarts processing for a failed or stalled call, right from the Call Log row. */
export function RetryButton({ id, analyzeOnly }: { id: string; analyzeOnly: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/calls/${id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Transcription already succeeded when analysis is what failed: don't pay for it again.
      body: JSON.stringify({ analyzeOnly }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? "Couldn't restart. Try again.");
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={retry}
      disabled={busy}
      title={error ?? undefined}
      className="rounded-lg bg-red-soft px-3.5 py-1.5 text-sm font-semibold text-red hover:brightness-95 disabled:opacity-60"
    >
      {busy ? "Starting…" : error ? "Retry again" : "Retry"}
    </button>
  );
}
