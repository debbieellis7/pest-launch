"use client";

import { useEffect, useMemo, useRef } from "react";
import { formatDuration } from "@/lib/format";
import type { CallDetail } from "@/lib/queries";
import { mergeForDisplay } from "@/lib/transcript";
import { Card, cx } from "../ui";

type T = NonNullable<CallDetail["transcript"]>;

export function Transcript({
  transcript,
  repName,
  time,
  onSeek,
}: {
  transcript: T;
  repName: string | null;
  time: number;
  onSeek: (sec: number) => void;
}) {
  const { repSpeaker } = transcript;
  const utterances = useMemo(() => mergeForDisplay(transcript.utterances), [transcript.utterances]);
  const list = useRef<HTMLOListElement>(null);

  const customer = useMemo(() => {
    if (repSpeaker == null) return null;
    const words = new Map<number, number>();
    for (const u of utterances) {
      if (u.speaker !== repSpeaker)
        words.set(u.speaker, (words.get(u.speaker) ?? 0) + u.text.length);
    }
    return [...words.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [utterances, repSpeaker]);

  const who = (speaker: number) => {
    if (repSpeaker == null) return { name: `Speaker ${speaker + 1}`, rep: false };
    if (speaker === repSpeaker) return { name: repName ?? "Rep", rep: true };
    return { name: speaker === customer ? "Caller" : `Speaker ${speaker + 1}`, rep: false };
  };

  // The line being spoken right now.
  const active = time > 0 ? utterances.findLastIndex((u) => u.start <= time + 0.1) : -1;

  // Follow playback inside the transcript box only (never scroll the page).
  useEffect(() => {
    const box = list.current;
    const el = box?.children[active] as HTMLElement | undefined;
    if (!box || !el) return;
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: top - box.clientHeight / 3, behavior: "smooth" });
    }
  }, [active]);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="text-[15px] font-semibold">Transcript</h2>
        <span className="text-xs text-faint">Click a line to play from there</span>
      </div>
      {utterances.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">No speech was detected.</p>
      ) : (
        <ol
          ref={list}
          className="max-h-[60vh] space-y-1 overflow-y-auto px-3 py-3 lg:max-h-[calc(100vh-220px)]"
        >
          {utterances.map((u, i) => {
            const speaker = who(u.speaker);
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onSeek(u.start)}
                  className={cx(
                    "w-full rounded-xl px-3 py-2 text-left transition-colors",
                    i === active ? "bg-accent-soft" : "hover:bg-black/[0.03]",
                  )}
                >
                  <span className="flex items-baseline gap-2 text-xs">
                    <span className={cx("font-semibold", speaker.rep ? "text-accent" : "text-ink")}>
                      {speaker.name}
                    </span>
                    <span className="tabular-nums text-faint">{formatDuration(u.start)}</span>
                  </span>
                  <span className="mt-0.5 block text-[14px] leading-relaxed">{u.text}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {transcript.resegmented && (
        <p className="border-t border-line px-5 py-2.5 text-xs text-muted">
          Speakers were separated by AI because the recording didn&apos;t separate cleanly.
        </p>
      )}
    </Card>
  );
}
