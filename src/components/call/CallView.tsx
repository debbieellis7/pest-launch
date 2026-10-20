"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate, formatDuration, isProcessing } from "@/lib/format";
import type { CallDetail } from "@/lib/queries";
import { AutoRefresh } from "../AutoRefresh";
import { Card, GradeBadge, TypePill } from "../ui";
import { Coaching } from "./Coaching";
import { Outcome } from "./Outcome";
import { ProcessingPanel } from "./ProcessingPanel";
import { Scorecard } from "./Scorecard";
import { Transcript } from "./Transcript";

export function CallView({ call }: { call: CallDetail }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);

  const seek = useCallback((sec: number) => {
    const el = audio.current;
    if (!el) return;
    el.currentTime = Math.max(0, sec - 0.5);
    void el.play().catch(() => {});
  }, []);

  // "Listen" in the Call Log opens this page with ?play=1: start the recording.
  const autoplay = useSearchParams().get("play") === "1";
  useEffect(() => {
    const el = audio.current;
    if (!autoplay || !el) return;
    const start = () => void el.play().catch(() => {});
    if (el.readyState >= 1) start();
    else el.addEventListener("loadedmetadata", start, { once: true });
    return () => el.removeEventListener("loadedmetadata", start);
  }, [autoplay]);

  const a = call.analysis;
  const full = call.full;
  const repName = a?.repName ?? null;

  return (
    <>
      <AutoRefresh active={isProcessing(call.status) && !call.stalled} />

      <Link href="/sales/calls" className="inline-flex items-center gap-1 text-[15px] text-accent">
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          aria-hidden
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Call Log
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[30px] font-bold tracking-tight">{call.label}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px] text-muted">
            {a && <TypePill type={a.callType} />}
            {[
              a?.callSubtype && (
                <span key="sub" className="capitalize">
                  {a.callSubtype}
                </span>
              ),
              <span key="date">{formatDate(call.callAt ?? call.createdAt)}</span>,
              <span key="len" className="tabular-nums">
                {formatDuration(call.durationSec)}
              </span>,
              repName && (
                <span key="rep">
                  Rep <span className="font-medium text-ink">{repName}</span>
                </span>
              ),
              a?.callerName && (
                <span key="caller">
                  Caller <span className="font-medium text-ink">{a.callerName}</span>
                </span>
              ),
            ]
              .filter(Boolean)
              .flatMap((el, i) => (i === 0 ? [el] : [<Dot key={`dot${i}`} />, el]))}
          </div>
        </div>
        {a &&
          (a.grade ? (
            <GradeBadge grade={a.grade} score={a.score} max={a.maxScore} size="lg" />
          ) : (
            <span className="rounded-full bg-black/[0.05] px-3.5 py-1.5 text-sm text-muted">
              Not graded{full?.unscorableReason ? ` · ${full.unscorableReason}` : ""}
            </span>
          ))}
      </header>

      {call.status !== "complete" && (
        <ProcessingPanel
          id={call.id}
          status={call.status}
          stalled={call.stalled}
          failedStage={call.failedStage}
          error={call.error}
          hasTranscript={Boolean(call.transcript?.utterances.length)}
        />
      )}

      {a?.needsReview && full && full.reviewReasons.length > 0 && (
        <div className="mt-6 rounded-2xl bg-[#fff8eb] px-5 py-4 ring-1 ring-[#f5a623]/30">
          <p className="text-sm font-semibold text-[#8a4b00]">Worth a second look</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-[#8a4b00]/90">
            {full.reviewReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          {full ? (
            <>
              <Outcome full={full} callType={a?.callType ?? "other"} />
              {full.items.length > 0 && (
                <Coaching coaching={full.coaching} items={full.items} onSeek={seek} />
              )}
              {full.items.length > 0 && a && (
                <Scorecard
                  items={full.items}
                  rubricId={full.rubricId}
                  score={a.score}
                  max={a.maxScore}
                  onSeek={seek}
                />
              )}
            </>
          ) : (
            <Card className="p-6">
              <p className="text-[15px] font-medium">Analysis isn&apos;t ready yet</p>
              <p className="mt-1 text-sm text-muted">
                The call type, outcome, scorecard and coaching appear here once the call has been
                analyzed.
              </p>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-4">
            {call.audioUrl ? (
              <audio
                ref={audio}
                src={call.audioUrl}
                controls
                preload="metadata"
                className="w-full"
                onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              />
            ) : (
              <p className="text-sm text-muted">Recording unavailable.</p>
            )}
          </Card>
          {call.transcript && (
            // "Transcript" in the Call Log links to #transcript.
            <div id="transcript" className="scroll-mt-6">
              <Transcript
                transcript={call.transcript}
                repName={repName}
                time={time}
                onSeek={seek}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Dot() {
  return <span className="text-faint">·</span>;
}
