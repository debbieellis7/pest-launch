"use client";

import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { cx } from "./ui";

type State =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "uploading"; progress: number }
  | { kind: "started" }
  | { kind: "error"; message: string; existingId?: string };

const ACCEPT = ".mp3,.wav,.m4a,.mp4,.aac,audio/*";

/**
 * One recording at a time: ask the server for a one-time storage URL, PUT the file
 * straight to private storage, then start processing (transcribe → analyze → score).
 * The Call Log refreshes itself while the new call is processed.
 */
export function UploadButton({ remaining, max }: { remaining: number; max: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const busy = state.kind === "preparing" || state.kind === "uploading";
  const full = remaining <= 0;

  async function upload(file: File) {
    setState({ kind: "preparing" });
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, size: file.size }),
      });
      const body = await res.json();
      if (!res.ok) {
        // Already uploaded: say so and link to the call instead of analysing it again.
        if (body.existingId) {
          setState({ kind: "error", message: body.error, existingId: body.existingId });
          return;
        }
        throw new Error(body.error ?? "Upload failed");
      }

      setState({ kind: "uploading", progress: 0 });
      await put(body.uploadUrl, file, (p) => setState({ kind: "uploading", progress: p }));

      const started = await fetch(`/api/calls/${body.id}/process`, { method: "POST" });
      if (!started.ok) {
        throw new Error("Uploaded, but processing didn't start. Use Retry on the call.");
      }
      setState({ kind: "started" });
      router.refresh();
      setTimeout(() => setState({ kind: "idle" }), 3000);
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Upload failed" });
      router.refresh();
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy || full || state.kind === "started"}
        aria-busy={busy}
        title={full ? `This demo is limited to ${max} calls.` : undefined}
        className={cx(
          "relative inline-flex min-w-[170px] items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-2.5 text-[15px] font-semibold transition",
          busy
            ? "bg-accent-soft text-accent ring-1 ring-accent/20"
            : state.kind === "started"
              ? "bg-green-soft text-green ring-1 ring-green/20"
              : full
                ? "bg-black/[0.07] text-muted"
                : "bg-accent text-white shadow-sm hover:brightness-110 active:brightness-95",
        )}
      >
        {state.kind === "preparing" ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Preparing…
          </>
        ) : state.kind === "uploading" ? (
          <>
            {/* Fill grows with the upload so progress reads at a glance. */}
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-accent/15 transition-[width] duration-200"
              style={{ width: `${Math.round(state.progress * 100)}%` }}
            />
            <Loader2 className="relative size-4 animate-spin" aria-hidden />
            <span className="relative tabular-nums">
              Uploading {Math.round(state.progress * 100)}%
            </span>
          </>
        ) : state.kind === "started" ? (
          <>
            <Check className="size-4" strokeWidth={2.5} aria-hidden />
            Processing started
          </>
        ) : full ? (
          `Limit reached (${max} calls)`
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Upload call
          </>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />

      {state.kind === "error" && (
        <div
          role="alert"
          className="absolute right-0 z-20 mt-2 flex w-72 items-start gap-2 rounded-xl bg-white p-3 text-sm text-red shadow-lg ring-1 ring-black/5"
        >
          <span className="flex-1">
            {state.message}
            {state.existingId && (
              <Link
                href={`/sales/calls/${state.existingId}`}
                className="mt-1 block font-medium text-accent hover:underline"
              >
                Open it →
              </Link>
            )}
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setState({ kind: "idle" })}
            className="text-faint hover:text-ink"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

/** PUT with upload progress (fetch can't report it). */
function put(url: string, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "audio/mpeg");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
    xhr.send(file);
  });
}
