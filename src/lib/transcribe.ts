// Speech-to-text with Deepgram. Stereo recordings put the rep and the customer on
// separate channels, so we transcribe per channel; mono recordings need diarization.
import { createClient, type SyncPrerecordedResponse } from "@deepgram/sdk";
import type { Utterance } from "./evidence";

export interface TranscriptUtterance extends Utterance {
  confidence: number;
}

export interface TranscriptResult {
  mode: "diarize" | "multichannel";
  utterances: TranscriptUtterance[];
  durationSec: number;
  channels: number;
  meta: { model: string | null; requestId: string | null };
}

// Pest-control vocabulary nudges recognition on low-bitrate phone audio.
const KEYTERMS = [
  "pest control",
  "re-service",
  "quarterly",
  "bi-monthly",
  "initial service",
  "termite",
  "rodent",
  "mosquito",
  "cockroach",
  "spider",
  "ants",
  "wasps",
  "technician",
  "autopay",
];

export async function transcribeRecording(audioUrl: string): Promise<TranscriptResult> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY must be set");

  // We don't know the channel count up front (browser uploads), so ask for both:
  // Deepgram splits stereo by channel and diarizes mono, and reports which it saw.
  const { result, error } = await createClient(key).listen.prerecorded.transcribeUrl(
    { url: audioUrl },
    {
      model: "nova-3",
      language: "en-US",
      smart_format: true,
      punctuate: true,
      utterances: true,
      multichannel: true,
      diarize: true,
      keyterm: KEYTERMS,
      // Opt out of Deepgram's Model Improvement Program: recordings are real customer
      // calls and must not be kept or used for training (kept only to process the request).
      mip_opt_out: true,
    },
  );
  if (error || !result) throw new Error(`Deepgram failed: ${error?.message ?? "no result"}`);

  return toTranscript(result);
}

export function toTranscript(result: SyncPrerecordedResponse): TranscriptResult {
  const mode: TranscriptResult["mode"] = result.metadata.channels >= 2 ? "multichannel" : "diarize";
  const utterances = (
    mode === "multichannel"
      ? (result.results.utterances ?? []).map((u) => ({
          // In multichannel mode the channel *is* the speaker.
          speaker: u.channel,
          start: round2(u.start),
          end: round2(u.end),
          text: u.transcript.trim(),
          confidence: round2(u.confidence),
        }))
      : linesFromWords(result.results.channels[0]?.alternatives[0]?.words ?? [])
  )
    .filter((u) => u.text.length > 0)
    .sort((a, b) => a.start - b.start);

  return {
    mode,
    utterances,
    durationSec: round2(result.metadata.duration),
    channels: result.metadata.channels,
    meta: {
      model: Object.values(result.metadata.model_info ?? {})[0]?.name ?? null,
      requestId: result.metadata.request_id ?? null,
    },
  };
}

/** A pause this long starts a new line even when the same person keeps talking. */
const LINE_PAUSE_SEC = 0.8;

interface Word {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

/**
 * Mono calls: Deepgram labels every word with a speaker, but its utterance blocks don't
 * break when the speaker changes (CALL-004 had 0:56–1:23 as one "rep" block with the
 * caller's lines inside). So build lines from the words: a new line on every speaker
 * change or pause.
 */
export function linesFromWords(words: Word[]): TranscriptUtterance[] {
  const lines: { speaker: number; start: number; end: number; words: Word[] }[] = [];
  for (const w of words) {
    const speaker = w.speaker ?? 0;
    const last = lines.at(-1);
    if (last && last.speaker === speaker && w.start - last.end <= LINE_PAUSE_SEC) {
      last.words.push(w);
      last.end = w.end;
    } else {
      lines.push({ speaker, start: w.start, end: w.end, words: [w] });
    }
  }
  return lines.map((l) => ({
    speaker: l.speaker,
    start: round2(l.start),
    end: round2(l.end),
    text: l.words
      .map((w) => w.punctuated_word ?? w.word)
      .join(" ")
      .trim(),
    confidence: round2(l.words.reduce((s, w) => s + w.confidence, 0) / l.words.length),
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
