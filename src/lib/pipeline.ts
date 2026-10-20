// Runs one call through transcription → analysis → scoring, recording progress on
// the calls row so the UI can show status and failures can be retried per stage.
import { analysisModel, classifyCall, scoreWithRubric, splitSpeakers } from "./analysis/analyze";
import { PROMPT_VERSION, formatTranscript } from "./analysis/prompts";
import { buildAnalysis, rubricForClassification } from "./analysis/record";
import { alignTurns, mixedSpeakersNote, needsResegmenting } from "./analysis/resegment";
import type { Classification } from "./analysis/schemas";
import { STALE_AFTER_MS } from "./format";
import { db, signedRecordingUrl } from "./supabase";
import { transcribeRecording, type TranscriptUtterance } from "./transcribe";

type Stage = "upload" | "transcribe" | "analyze";

export interface ProcessOptions {
  /** Reuse the stored transcript and only re-run analysis (e.g. after a prompt change). */
  analyzeOnly?: boolean;
}

export interface ClaimedCall {
  id: string;
  storage_path: string | null;
}

/**
 * Claim the call so two requests can't process it at once. A run that died mid-way
 * (e.g. the serverless function timed out) can be reclaimed after STALE_AFTER_MS.
 * Returns null when the call is already being processed or doesn't exist.
 */
export async function claimCall(
  callId: string,
  opts: ProcessOptions = {},
): Promise<ClaimedCall | null> {
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const { data: claimed, error: claimError } = await db()
    .from("calls")
    .update({
      status: opts.analyzeOnly ? "analyzing" : "transcribing",
      failed_stage: null,
      error: null,
    })
    .eq("id", callId)
    .or(`status.in.(uploaded,failed,complete),updated_at.lt.${staleBefore}`)
    .select("id, storage_path")
    .maybeSingle();
  if (claimError) throw new Error(`Could not claim call: ${claimError.message}`);
  return claimed;
}

export async function processCall(callId: string, opts: ProcessOptions = {}): Promise<void> {
  const claimed = await claimCall(callId, opts);
  if (!claimed) return; // already processing, or doesn't exist
  await runClaimed(claimed, opts);
}

/** Transcribe → analyze → score a call already claimed with `claimCall`. */
export async function runClaimed(claimed: ClaimedCall, opts: ProcessOptions = {}): Promise<void> {
  const supabase = db();
  const callId = claimed.id;
  let stage: Stage = "upload";
  try {
    if (!claimed.storage_path) throw new Error("No recording was uploaded for this call");

    let transcript: StoredTranscript;

    if (opts.analyzeOnly) {
      stage = "analyze";
      const { data, error } = await supabase
        .from("transcripts")
        .select("mode, utterances, provider_meta, calls(duration_sec)")
        .eq("call_id", callId)
        .single();
      if (error || !data) throw new Error("No stored transcript to re-analyze");
      const utterances = data.utterances as TranscriptUtterance[];
      const call = data.calls as unknown as { duration_sec: number | null } | null;
      transcript = {
        mode: data.mode,
        utterances,
        durationSec: Number(call?.duration_sec ?? utterances.at(-1)?.end ?? 0),
        meta: (data.provider_meta ?? {}) as Record<string, unknown>,
      };
    } else {
      const audioUrl = await signedRecordingUrl(claimed.storage_path); // fails if the upload never landed
      stage = "transcribe";
      const result = await transcribeRecording(audioUrl);
      transcript = { ...result, meta: result.meta };

      const { error: tErr } = await supabase.from("transcripts").upsert({
        call_id: callId,
        mode: result.mode,
        utterances: result.utterances,
        rep_speaker: null,
        provider: "deepgram",
        provider_meta: result.meta,
      });
      if (tErr) throw new Error(`Saving transcript failed: ${tErr.message}`);
      await update(callId, {
        status: "analyzing",
        duration_sec: result.durationSec,
        channels: result.channels,
        transcribed_at: new Date().toISOString(),
      });
    }

    stage = "analyze";
    const record =
      transcript.utterances.length === 0
        ? silentCallRecord()
        : await analyzeTranscript(callId, transcript);

    const repId = record.rep_name ? await findOrCreateRep(record.rep_name) : null;
    const { error: aErr } = await supabase.from("analyses").upsert({
      call_id: callId,
      rep_id: repId,
      ...record,
      model: analysisModel(),
      prompt_version: PROMPT_VERSION,
    });
    if (aErr) throw new Error(`Saving analysis failed: ${aErr.message}`);

    await update(callId, { status: "complete", analyzed_at: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await update(callId, { status: "failed", failed_stage: stage, error: message.slice(0, 500) });
    throw err;
  }
}

interface StoredTranscript {
  mode: "diarize" | "multichannel";
  utterances: TranscriptUtterance[];
  durationSec: number;
  meta: Record<string, unknown>;
}

const RESEGMENTED_NOTE = "Speakers were separated by AI (the audio didn't separate cleanly)";

async function analyzeTranscript(callId: string, transcript: StoredTranscript) {
  const { durationSec } = transcript;
  let { utterances } = transcript;
  const extraReview: string[] = [];

  if (needsResegmenting(transcript.mode, utterances, durationSec)) {
    const turns = await splitSpeakers(utterances.map((u) => u.text).join("\n"));
    const original = utterances;
    utterances = alignTurns(original, turns);
    const { error } = await db()
      .from("transcripts")
      .update({
        utterances,
        provider_meta: { ...transcript.meta, resegmented: true, original_utterances: original },
      })
      .eq("call_id", callId);
    if (error) throw new Error(`Saving separated transcript failed: ${error.message}`);
    extraReview.push(RESEGMENTED_NOTE);
  } else if (transcript.meta.resegmented) {
    extraReview.push(RESEGMENTED_NOTE);
  }

  const classification: Classification = await classifyCall(
    formatTranscript(utterances),
    durationSec,
  );
  classification.review_flags.push(...extraReview);
  // Skip when the model already flagged mixed-up speakers, so it isn't said twice.
  const mixed = mixedSpeakersNote(transcript.mode, utterances, extraReview.length > 0);
  if (mixed && !classification.review_flags.some((f) => /speaker/i.test(f))) {
    classification.review_flags.push(mixed);
  }

  await db()
    .from("transcripts")
    .update({ rep_speaker: classification.rep_speaker })
    .eq("call_id", callId);

  const rubric = rubricForClassification(classification);
  const scorecard = rubric
    ? await scoreWithRubric(
        rubric,
        formatTranscript(utterances, classification.rep_speaker),
        durationSec,
        classification,
      )
    : null;

  return buildAnalysis(classification, rubric, scorecard, utterances);
}

function silentCallRecord(): ReturnType<typeof buildAnalysis> {
  return {
    rep_name: null,
    company: null,
    caller_name: null,
    call_type: "other",
    call_subtype: null,
    type_confidence: 1,
    scorable: false,
    unscorable_reason: "No speech detected",
    summary: "No speech was detected in this recording.",
    outcome: {
      result: "no_outcome",
      headline: "No conversation",
      sale: null,
      retention: null,
      service: null,
      next_steps: [],
    },
    details: {
      direction: "unknown",
      customer_status: "unknown",
      pests: [],
      objections: [],
      sentiment: "neutral",
    },
    rubric_id: null,
    rubric_version: null,
    items: [],
    score: null,
    max_score: null,
    grade: null,
    coaching: {},
    needs_review: false,
    review_reasons: [],
  };
}

async function findOrCreateRep(name: string): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;
  const supabase = db();
  // Case-insensitive exact match (escape LIKE wildcards in the name).
  const lookup = () =>
    supabase
      .from("reps")
      .select("id")
      .ilike("name", clean.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle();

  const { data: existing } = await lookup();
  if (existing) return existing.id;
  const { data, error } = await supabase.from("reps").insert({ name: clean }).select("id").single();
  if (error) {
    // Lost a race with another call inserting the same rep: look it up again.
    const { data: again } = await lookup();
    return again?.id ?? null;
  }
  return data.id;
}

async function update(callId: string, fields: Record<string, unknown>): Promise<void> {
  const { error } = await db().from("calls").update(fields).eq("id", callId);
  if (error) throw new Error(`Updating call failed: ${error.message}`);
}
