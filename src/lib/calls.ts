// Creating call records, shared by the upload API and the bulk import script.
import { RECORDINGS_BUCKET, db } from "./supabase";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // matches the bucket's file_size_limit

export const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/x-m4a",
  mp4: "audio/mp4",
  aac: "audio/aac",
};

/** "CALL 014.mp3" → "CALL-014"; anything else → the file name without its extension. */
export function labelFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  const numbered = base.match(/^call[\s_-]*(\d+)$/i);
  if (numbered) return `CALL-${numbered[1].padStart(3, "0")}`;
  return base.slice(0, 80) || "Untitled call";
}

export function extensionOf(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ext in AUDIO_TYPES ? ext : null;
}

/** Cap on how many calls this demo holds, so AI spend stays bounded (env MAX_CALLS, default 10). */
export function maxCalls(): number {
  const n = Number(process.env.MAX_CALLS);
  return Number.isInteger(n) && n > 0 ? n : 10;
}

export function limitReached(count: number, max: number): boolean {
  return count >= max;
}

export class CallLimitError extends Error {
  constructor(public max: number) {
    super(`This demo is limited to ${max} calls.`);
    this.name = "CallLimitError";
  }
}

/** The same recording (by file name) was already uploaded. */
export class DuplicateCallError extends Error {
  constructor(
    public existingId: string,
    public label: string,
    filename: string,
  ) {
    super(`${filename} is already in the Call Log (${label}).`);
    this.name = "DuplicateCallError";
  }
}

/** Escape LIKE wildcards so a file name like "call_016.mp3" only matches itself. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function countCalls(): Promise<number> {
  const { count, error } = await db().from("calls").select("*", { count: "exact", head: true });
  if (error) throw new Error(`Counting calls failed: ${error.message}`);
  return count ?? 0;
}

export async function createCall(filename: string): Promise<{ id: string; storagePath: string }> {
  const ext = extensionOf(filename);
  if (!ext) throw new Error("Unsupported audio format");
  const name = filename.slice(0, 200);
  // Same file name (any letter case) already uploaded: refuse instead of analysing it twice.
  const { data: existing, error: dupError } = await db()
    .from("calls")
    .select("id, label")
    .ilike("original_filename", escapeLike(name))
    .limit(1);
  if (dupError) throw new Error(`Checking for duplicates failed: ${dupError.message}`);
  if (existing?.[0]) throw new DuplicateCallError(existing[0].id, existing[0].label, name);
  const max = maxCalls();
  if (limitReached(await countCalls(), max)) throw new CallLimitError(max);
  const id = crypto.randomUUID();
  const storagePath = `calls/${id}.${ext}`;
  const { error } = await db()
    .from("calls")
    .insert({
      id,
      label: labelFromFilename(filename),
      original_filename: name,
      storage_path: storagePath,
      status: "uploaded",
    });
  if (error) throw new Error(`Creating call failed: ${error.message}`);
  return { id, storagePath };
}

export async function signedUploadUrl(storagePath: string): Promise<string> {
  const { data, error } = await db()
    .storage.from(RECORDINGS_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (error || !data)
    throw new Error(`Could not create upload URL: ${error?.message ?? "unknown"}`);
  return data.signedUrl;
}
