// Fallback for mono calls where diarization collapsed everyone into one speaker
// (common on low-bitrate phone audio). The model splits the text into rep/customer
// turns, copying words verbatim; here we map those turns back onto the audio timeline.
import { normalizeTokens } from "../evidence";
import { formatDuration } from "../format";
import type { TranscriptUtterance } from "../transcribe";

export const ROLE_SPEAKER = { rep: 0, customer: 1, other: 2 } as const;
export type Role = keyof typeof ROLE_SPEAKER;

export interface Turn {
  speaker: Role;
  text: string;
}

/** True when a multi-party call came back as a single speaker. */
export function needsResegmenting(
  mode: "diarize" | "multichannel",
  utterances: TranscriptUtterance[],
  durationSec: number,
): boolean {
  if (mode !== "diarize" || utterances.length < 2 || durationSec < 20) return false;
  return new Set(utterances.map((u) => u.speaker)).size === 1;
}

/** One speaker talking this long on a mono call usually means two voices were merged. */
export const LONG_MONO_STRETCH_SEC = 20;

/**
 * Mono calls can also come back with two speakers but some long stretches credited to one
 * of them, with both voices inside (seen on CALL-004 and CALL-007). Returns a review note
 * naming where, or null. Stereo calls split by channel and AI-split calls are left alone.
 */
export function mixedSpeakersNote(
  mode: "diarize" | "multichannel",
  utterances: TranscriptUtterance[],
  aiSplit: boolean,
): string | null {
  if (mode !== "diarize" || aiSplit) return null;
  const starts = utterances
    .filter((u) => u.end - u.start > LONG_MONO_STRETCH_SEC)
    .map((u) => formatDuration(u.start));
  if (starts.length === 0) return null;
  return `Speaker labels may be mixed around ${starts.join(", ")} (the recording is mono)`;
}

/**
 * Gives each turn a start/end time by its position in the original word stream.
 * Each word's time is interpolated within the utterance it came from, which is accurate
 * to about a second — enough for click-to-seek. If the model's word count drifts from
 * the original, positions are scaled proportionally so times stay monotonic.
 */
export function alignTurns(original: TranscriptUtterance[], turns: Turn[]): TranscriptUtterance[] {
  const times: number[] = [];
  const confidences: number[] = [];
  for (const u of original) {
    const n = normalizeTokens(u.text).length;
    for (let i = 0; i < n; i++) {
      times.push(u.start + ((u.end - u.start) * i) / Math.max(1, n));
      confidences.push(u.confidence);
    }
  }
  const end = original.at(-1)?.end ?? 0;
  const kept = turns.filter((t) => normalizeTokens(t.text).length > 0);
  const totalModelTokens = kept.reduce((sum, t) => sum + normalizeTokens(t.text).length, 0);
  if (times.length === 0 || totalModelTokens === 0) return original;

  const scale = times.length / totalModelTokens;
  const timeAt = (modelIndex: number) =>
    modelIndex * scale >= times.length ? end : times[Math.floor(modelIndex * scale)];

  let position = 0;
  return kept.map((turn, i) => {
    const n = normalizeTokens(turn.text).length;
    const startIdx = position;
    position += n;
    const start = timeAt(startIdx);
    const next = i + 1 < kept.length ? timeAt(position) : end;
    const confSlice = confidences.slice(Math.floor(startIdx * scale), Math.ceil(position * scale));
    return {
      speaker: ROLE_SPEAKER[turn.speaker],
      start: Math.round(start * 100) / 100,
      end: Math.round(Math.max(start, next) * 100) / 100,
      text: turn.text.trim(),
      confidence: confSlice.length ? Math.min(...confSlice) : 0,
    };
  });
}
