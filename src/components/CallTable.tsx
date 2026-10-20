import Link from "next/link";
import { Loader2 } from "lucide-react";
import { TYPE_LABEL, formatDate, formatDuration, friendlyError, isProcessing } from "@/lib/format";
import type { CallSummary } from "@/lib/queries";
import { RetryButton } from "./RetryButton";
import { GradeBadge, ResultText, StatusBadge, cx } from "./ui";

// Same columns as PestLaunch's Call Log, plus the grade Call Intelligence adds,
// and the same Listen / Transcript buttons on each row.
const GRID =
  "md:grid-cols-[0.75fr_0.5fr_0.7fr_1.2fr_0.8fr_0.45fr_1.75fr_0.85fr_178px] md:items-center md:gap-4";

export function CallTable({ calls, empty }: { calls: CallSummary[]; empty: React.ReactNode }) {
  return (
    <div>
      <div
        className={cx(
          "hidden border-b border-line pb-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-[#3a3a3c] md:grid [&>span]:whitespace-nowrap",
          GRID,
        )}
      >
        <span>When</span>
        <span>In/Out</span>
        <span>Type</span>
        <span>Caller / Number</span>
        <span>Rep</span>
        <span>Talk</span>
        <span>Outcome</span>
        <span>Grade</span>
        <span />
      </div>
      {calls.length === 0 ? (
        empty
      ) : (
        <ul>
          {calls.map((call) => (
            <CallRow key={call.id} call={call} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CallRow({ call }: { call: CallSummary }) {
  const a = call.analysis;
  const dir = a?.direction === "inbound" ? "In" : a?.direction === "outbound" ? "Out" : null;
  const href = `/sales/calls/${call.id}`;
  // Still working on it (not failed or stalled): show progress instead of empty columns.
  const pending = isProcessing(call.status) && !call.stalled;
  const empty = (width: string) => (pending ? <Pending width={width} /> : <Dash />);
  return (
    <li className="group relative border-b border-line last:border-0">
      {/* Clicking anywhere on the row opens the call; the buttons sit above this link. */}
      <Link
        href={href}
        aria-label={`Open ${call.label}`}
        className={cx(
          "absolute inset-y-0 -inset-x-3 rounded-xl transition-colors",
          // A light blue wash marks rows still being processed.
          pending ? "bg-accent-soft/60 group-hover:bg-accent-soft" : "group-hover:bg-black/[0.025]",
        )}
      />
      <div className={cx("grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3.5", GRID)}>
        <div className="pointer-events-none relative min-w-0">
          <p className="text-[15px] text-[#3a3a3c]">{formatDate(call.callAt ?? call.createdAt)}</p>
          <p className="text-xs text-faint md:hidden">{call.label}</p>
        </div>
        <span className="pointer-events-none relative hidden text-[15px] text-[#3a3a3c] md:block">
          {dir ?? empty("w-6")}
        </span>
        <span className="pointer-events-none relative justify-self-end text-[15px] text-[#3a3a3c] md:justify-self-start">
          {a ? TYPE_LABEL[a.callType] : empty("w-14")}
        </span>
        {/* Like PestLaunch: caller name in bold caps, identifier underneath. Uploaded recordings
            carry no caller ID, so the call's ID stands in for the number. */}
        <div className="pointer-events-none relative hidden min-w-0 md:block">
          <p className="truncate text-[15px] font-bold uppercase tracking-tight">
            {a?.callerName ?? call.label}
          </p>
          {a?.callerName && <p className="truncate text-[13px] text-faint">{call.label}</p>}
        </div>
        <span className="pointer-events-none relative hidden truncate text-[15px] text-[#3a3a3c] md:block">
          {a?.repName ?? empty("w-16")}
        </span>
        <span className="pointer-events-none relative hidden text-[15px] tabular-nums text-[#3a3a3c] md:block">
          {pending && call.durationSec == null ? empty("w-8") : formatDuration(call.durationSec)}
        </span>
        <div className="pointer-events-none relative col-span-2 min-w-0 md:col-span-1">
          {pending ? (
            <ProcessingProgress status={call.status} />
          ) : a ? (
            <>
              <ResultText result={a.result} className="text-[15px]" />
              {a.headline && <p className="truncate text-[13px] text-muted">{a.headline}</p>}
            </>
          ) : (
            <span
              className="text-[15px] text-muted"
              title={
                call.status === "failed" ? friendlyError(call.error, call.failedStage) : undefined
              }
            >
              {call.status === "failed"
                ? "Processing failed"
                : call.stalled
                  ? "Processing stalled"
                  : "Processing…"}
            </span>
          )}
        </div>
        <div className="pointer-events-none relative flex items-center gap-2">
          {pending ? (
            <span className="text-sm text-faint">{PROGRESS[call.status]?.step ?? "Queued"}</span>
          ) : a ? (
            <GradeBadge grade={a.grade} score={a.score} max={a.maxScore} />
          ) : (
            <StatusBadge status={call.status} stalled={call.stalled} />
          )}
        </div>
        <div className="relative z-10 hidden items-center justify-end gap-2 md:flex">
          {call.status === "failed" || call.stalled ? (
            <RetryButton
              id={call.id}
              // Reuse the transcript when it's the analysis that failed or stalled.
              analyzeOnly={
                call.status === "failed"
                  ? call.failedStage === "analyze"
                  : call.status === "analyzing"
              }
            />
          ) : pending ? null : (
            <>
              <Link
                href={`${href}?play=1`}
                className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
              >
                Listen
              </Link>
              <Link
                href={`${href}#transcript`}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-ink shadow-sm ring-1 ring-line hover:bg-black/[0.03]"
              >
                Transcript
              </Link>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

const PROGRESS: Record<string, { text: string; current: number; step: string }> = {
  uploaded: { text: "Waiting to start…", current: 0, step: "Queued" },
  transcribing: { text: "Transcribing audio…", current: 1, step: "Step 1 of 2" },
  analyzing: { text: "Grading & coaching…", current: 2, step: "Step 2 of 2" },
};

/** What's happening now, plus a 2-part bar (transcribe, then grade); the page refreshes itself. */
function ProcessingProgress({ status }: { status: string }) {
  const p = PROGRESS[status] ?? PROGRESS.uploaded;
  return (
    <>
      <p className="flex items-center gap-1.5 text-[15px] text-accent">
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        <span className="truncate">{p.text}</span>
      </p>
      <div className="mt-1.5 flex max-w-[220px] gap-1" aria-hidden>
        {[1, 2].map((part) => (
          <span
            key={part}
            className={cx(
              "h-1 flex-1 rounded-full",
              part < p.current
                ? "bg-accent"
                : part === p.current
                  ? "animate-pulse bg-accent/60"
                  : "bg-black/[0.07]",
            )}
          />
        ))}
      </div>
    </>
  );
}

/** Grey placeholder for a value that arrives once the call is analyzed. */
function Pending({ width }: { width: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-block h-3 animate-pulse rounded bg-black/[0.07] align-middle", width)}
    />
  );
}

function Dash() {
  return <span className="text-faint">-</span>;
}
