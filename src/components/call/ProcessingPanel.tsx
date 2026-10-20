"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUS_LABEL, friendlyError, type CallStatus } from "@/lib/format";
import { Card, cx } from "../ui";

const STEPS: { status: CallStatus; label: string }[] = [
  { status: "uploaded", label: "Uploaded" },
  { status: "transcribing", label: "Transcribing" },
  { status: "analyzing", label: "Grading & coaching" },
  { status: "complete", label: "Done" },
];

export function ProcessingPanel({
  id,
  status,
  stalled,
  failedStage,
  error,
  hasTranscript,
}: {
  id: string;
  status: CallStatus;
  stalled: boolean;
  failedStage: string | null;
  error: string | null;
  hasTranscript: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/calls/${id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Transcription already succeeded: don't pay for it again.
      body: JSON.stringify({
        analyzeOnly:
          hasTranscript &&
          (status === "failed" ? failedStage === "analyze" : status === "analyzing"),
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setMessage(body?.error ?? "Couldn't restart processing. Try again in a moment.");
    }
    router.refresh();
  }

  if (status === "failed" || stalled) {
    return (
      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className={cx("text-[15px] font-semibold", stalled ? "text-gold" : "text-red")}>
            {stalled
              ? "Processing stalled"
              : failedStage === "transcribe"
                ? "Transcription failed"
                : failedStage === "upload"
                  ? "The recording didn't upload"
                  : "Analysis failed"}
          </p>
          <p
            className="mt-0.5 text-sm text-muted"
            title={!stalled && error ? `Details: ${error}` : undefined}
          >
            {stalled
              ? "This call stopped making progress, usually because the server hit its time limit. Retry to start it again."
              : friendlyError(error, failedStage)}
          </p>
          {message && <p className="mt-1 text-sm text-red">{message}</p>}
        </div>
        <button
          type="button"
          onClick={retry}
          disabled={busy}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Starting…" : "Retry"}
        </button>
      </Card>
    );
  }

  const current = STEPS.findIndex((s) => s.status === status);
  return (
    <Card className="mt-6 p-5">
      <p className="text-[15px] font-semibold">{STATUS_LABEL[status]}…</p>
      <p className="mt-0.5 text-sm text-muted">
        This usually takes a minute or two. The page updates on its own.
      </p>
      <ol className="mt-4 flex gap-2">
        {STEPS.map((s, i) => (
          <li key={s.status} className="flex-1">
            <div
              className={
                i < current
                  ? "h-1 rounded-full bg-accent"
                  : i === current
                    ? "h-1 animate-pulse rounded-full bg-accent/60"
                    : "h-1 rounded-full bg-black/[0.07]"
              }
            />
            <p className="mt-1.5 text-xs text-muted">{s.label}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
