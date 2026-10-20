// Server-side Supabase client using the service-role key.
// Never import this from a client component: the browser must not talk to Supabase.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const RECORDINGS_BUCKET = "recordings";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Short-lived URL for playing back (or handing Deepgram) a private recording. */
export async function signedRecordingUrl(path: string, expiresInSec = 600): Promise<string> {
  const { data, error } = await db()
    .storage.from(RECORDINGS_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error || !data)
    throw new Error(`Could not sign recording URL: ${error?.message ?? "unknown"}`);
  return data.signedUrl;
}
