// Server-side reads for the UI. Runs only in server components / route handlers.
import type { Classification, Scorecard } from "./analysis/schemas";
import { isStalled, type CallStatus, type CallType, type Grade } from "./format";
import { pageMeta, type PageMeta } from "./pagination";
import type { ScoredItem } from "./rubrics/types";
import { db, signedRecordingUrl } from "./supabase";
import type { TranscriptUtterance } from "./transcribe";

export interface CallSummary {
  id: string;
  label: string;
  status: CallStatus;
  failedStage: string | null;
  error: string | null;
  durationSec: number | null;
  createdAt: string;
  callAt: string | null;
  /** Still marked as processing but hasn't moved in over 10 minutes: offer Retry. */
  stalled: boolean;
  analysis: {
    callType: CallType;
    callSubtype: string | null;
    repName: string | null;
    callerName: string | null;
    scorable: boolean;
    score: number | null;
    maxScore: number | null;
    grade: Grade | null;
    needsReview: boolean;
    result: string | null;
    headline: string | null;
    direction: "inbound" | "outbound" | "unknown";
    /** Whether the caller is a new or an existing customer, as the analysis judged it. */
    customerStatus: "new" | "existing" | "unknown";
    rubricId: string | null;
    /** Full outcome and scored items, used by the Overview and Reps aggregations. */
    outcome: Classification["outcome"] | null;
    items: ScoredItem[];
  } | null;
}

export type Coaching = Partial<Scorecard["coaching"]>;

export interface CallDetail extends CallSummary {
  audioUrl: string | null;
  transcript: {
    mode: "diarize" | "multichannel";
    repSpeaker: number | null;
    utterances: TranscriptUtterance[];
    resegmented: boolean;
  } | null;
  full: {
    company: string | null;
    typeConfidence: number | null;
    unscorableReason: string | null;
    summary: string | null;
    outcome: Classification["outcome"] | null;
    details: Classification["details"] | null;
    rubricId: string | null;
    items: ScoredItem[];
    coaching: Coaching;
    reviewReasons: string[];
  } | null;
}

const SUMMARY_COLUMNS =
  "id, label, status, failed_stage, error, duration_sec, created_at, updated_at, call_at, analyses(call_type, call_subtype, rep_name, caller_name, scorable, score, max_score, grade, needs_review, outcome, details, rubric_id, items)";

// PostgREST returns a one-to-one embed as an object (or an array in some setups).
function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

type Row = Record<string, unknown>;

function toSummary(row: Row): CallSummary {
  const a = one(row.analyses as Row | Row[] | null);
  const outcome = (a?.outcome ?? null) as Classification["outcome"] | null;
  const details = (a?.details ?? null) as Partial<Classification["details"]> | null;
  return {
    id: row.id as string,
    label: row.label as string,
    status: row.status as CallStatus,
    failedStage: (row.failed_stage as string) ?? null,
    error: (row.error as string) ?? null,
    durationSec: row.duration_sec == null ? null : Number(row.duration_sec),
    createdAt: row.created_at as string,
    callAt: (row.call_at as string) ?? null,
    stalled: isStalled(row.status as string, row.updated_at as string),
    analysis: a
      ? {
          callType: a.call_type as CallType,
          callSubtype: (a.call_subtype as string) ?? null,
          repName: (a.rep_name as string) ?? null,
          callerName: (a.caller_name as string) ?? null,
          scorable: Boolean(a.scorable),
          score: (a.score as number) ?? null,
          maxScore: (a.max_score as number) ?? null,
          grade: (a.grade as Grade) ?? null,
          needsReview: Boolean(a.needs_review),
          result: outcome?.result ?? null,
          headline: outcome?.headline ?? null,
          direction: details?.direction ?? "unknown",
          customerStatus: details?.customer_status ?? "unknown",
          rubricId: (a.rubric_id as string) ?? null,
          outcome,
          items: (a.items as ScoredItem[]) ?? [],
        }
      : null,
  };
}

/** Newest first. Calls imported together (same hour) are ordered by label, CALL-020 … CALL-001. */
export async function listCalls(): Promise<CallSummary[]> {
  const { data, error } = await db().from("calls").select(SUMMARY_COLUMNS);
  if (error) throw new Error(`Loading calls failed: ${error.message}`);
  return (data as Row[]).map(toSummary).sort(byNewest);
}

// ---------------------------------------------------------------------------
// Call Log: the stats card reads a slim list of every call; the table asks the database
// for one page of rows only.
// ---------------------------------------------------------------------------

const STATS_COLUMNS =
  "id, label, status, created_at, updated_at, call_at, analyses(call_type, rep_name, score, max_score, grade, needs_review, direction:details->>direction)";

/** Every call with just the fields the Call Log stats card and Rep filter need. */
export async function listCallStats(): Promise<CallSummary[]> {
  const { data, error } = await db().from("calls").select(STATS_COLUMNS);
  if (error) throw new Error(`Loading call stats failed: ${error.message}`);
  return (data as Row[]).map((row) => {
    const a = one(row.analyses as Row | Row[] | null);
    return toSummary({ ...row, analyses: a && { ...a, details: { direction: a.direction } } });
  });
}

const PAGE_CALL_COLUMNS =
  "id, label, status, failed_stage, error, duration_sec, created_at, updated_at, call_at";
// Everything a table row shows; the heavy scorecard `items` stay in the database.
const PAGE_ANALYSIS_COLUMNS =
  "call_type, call_subtype, rep_name, caller_name, scorable, score, max_score, grade, needs_review, outcome, details, rubric_id";

export const OPEN_RESULTS = ["not_booked", "follow_up", "cancelled", "unresolved"] as const;

export interface CallPageFilters {
  /** Only calls added on or after this time (the 7d / 30d range). */
  since: Date;
  today?: boolean;
  type?: CallType | null;
  /** The Overview's "open service" link also counts billing calls as service. */
  includeBilling?: boolean;
  dir?: "inbound" | "outbound" | null;
  rep?: string | null;
  /** Only calls still waiting on something (not booked, follow-up, cancelled, unresolved). */
  open?: boolean;
  review?: boolean;
}

/** Ids of calls that need review: failed processing, or flagged by the analysis. */
async function reviewIds(): Promise<string[]> {
  const [failed, flagged] = await Promise.all([
    db().from("calls").select("id").eq("status", "failed"),
    db().from("analyses").select("call_id").eq("needs_review", true),
  ]);
  if (failed.error || flagged.error) {
    throw new Error(`Loading review list failed: ${(failed.error ?? flagged.error)!.message}`);
  }
  return [
    ...new Set([
      ...(failed.data as Row[]).map((r) => r.id as string),
      ...(flagged.data as Row[]).map((r) => r.call_id as string),
    ]),
  ];
}

/**
 * One page of Call Log rows, newest first. Filters, ordering and paging all run in the
 * database, so only `per` rows come back (plus the total count for the pager).
 */
export async function listCallPage(
  f: CallPageFilters,
  pageParam: string | undefined,
  per: number,
): Promise<{ calls: CallSummary[]; total: number; meta: PageMeta }> {
  // An inner join drops calls with no analysis yet; only use it when filtering on one.
  const analysisFilter = Boolean(f.type || f.dir || f.rep || f.open);
  const embed = `analyses${analysisFilter ? "!inner" : ""}(${PAGE_ANALYSIS_COLUMNS})`;
  const ids = f.review ? await reviewIds() : null;

  const run = (offset: number) => {
    let q = db()
      .from("calls")
      .select(`${PAGE_CALL_COLUMNS}, ${embed}`, { count: "exact" })
      .gte("created_at", f.since.toISOString());
    if (f.today) {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      q = q.gte("created_at", midnight.toISOString());
    }
    if (f.type) {
      q = f.includeBilling
        ? q.in("analyses.call_type", [f.type, "billing"])
        : q.eq("analyses.call_type", f.type);
    }
    if (f.dir) q = q.eq("analyses.details->>direction", f.dir);
    if (f.rep) q = q.eq("analyses.rep_name", f.rep);
    if (f.open) q = q.in("analyses.outcome->>result", [...OPEN_RESULTS]);
    // No matching ids: a filter nothing can satisfy, so the page comes back empty.
    if (ids) q = q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    return q.order("created_at", { ascending: false }).range(offset, offset + per - 1);
  };

  const requested = pageMeta(Number.MAX_SAFE_INTEGER, pageParam, per);
  let first = await run(requested.offset);
  // PostgREST answers a page past the end with 416 "Range not satisfiable" (PGRST103)
  // rather than an empty list; ask for the first page to learn the total instead.
  if (first.error?.code === "PGRST103") first = await run(0);
  if (first.error) throw new Error(`Loading calls failed: ${first.error.message}`);
  const total = first.count ?? 0;
  const meta = pageMeta(total, pageParam, per);
  let rows = first.data as unknown as Row[];
  // Asked for a page past the end (e.g. ?page=99): fetch the last page instead.
  if (meta.offset !== 0 && meta.offset !== requested.offset) {
    const last = await run(meta.offset);
    if (last.error) throw new Error(`Loading calls failed: ${last.error.message}`);
    rows = last.data as unknown as Row[];
  }
  return { calls: rows.map(toSummary), total, meta };
}

export function byNewest(a: CallSummary, b: CallSummary): number {
  const hour = (c: CallSummary) => Math.floor(Date.parse(c.callAt ?? c.createdAt) / 3_600_000);
  return hour(b) - hour(a) || b.label.localeCompare(a.label, "en", { numeric: true });
}

export async function getCall(id: string): Promise<CallDetail | null> {
  const { data, error } = await db()
    .from("calls")
    .select(
      `id, label, status, failed_stage, error, duration_sec, created_at, updated_at, call_at, storage_path,
       analyses(*), transcripts(mode, rep_speaker, utterances, provider_meta)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Loading call failed: ${error.message}`);
  if (!data) return null;

  const row = data as Row;
  const a = one(row.analyses as Row | Row[] | null);
  const t = one(row.transcripts as Row | Row[] | null);
  const storagePath = row.storage_path as string | null;

  return {
    ...toSummary({ ...row, analyses: a }),
    audioUrl: storagePath ? await signedRecordingUrl(storagePath, 60 * 60).catch(() => null) : null,
    transcript: t
      ? {
          mode: t.mode as "diarize" | "multichannel",
          repSpeaker: (t.rep_speaker as number) ?? null,
          utterances: (t.utterances as TranscriptUtterance[]) ?? [],
          resegmented: Boolean((t.provider_meta as Row | null)?.resegmented),
        }
      : null,
    full: a
      ? {
          company: (a.company as string) ?? null,
          typeConfidence: a.type_confidence == null ? null : Number(a.type_confidence),
          unscorableReason: (a.unscorable_reason as string) ?? null,
          summary: (a.summary as string) ?? null,
          outcome: (a.outcome as Classification["outcome"]) ?? null,
          details: (a.details as Classification["details"]) ?? null,
          rubricId: (a.rubric_id as string) ?? null,
          items: (a.items as ScoredItem[]) ?? [],
          coaching: (a.coaching as Coaching) ?? {},
          reviewReasons: (a.review_reasons as string[]) ?? [],
        }
      : null,
  };
}
