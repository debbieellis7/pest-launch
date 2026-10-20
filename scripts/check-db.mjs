// Confirms the schema migration ran: tables reachable with the service key and the
// private "recordings" bucket exists. Prints only table names, row counts and
// bucket visibility — never env values or row contents.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let ok = true;
for (const table of ["calls", "transcripts", "reps", "analyses"]) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) {
    ok = false;
    console.log(`✗ ${table.padEnd(12)} ${error.message}`);
  } else {
    console.log(`✓ ${table.padEnd(12)} ${count} rows`);
  }
}

const { data: bucket, error: bucketError } = await supabase.storage.getBucket("recordings");
if (bucketError || !bucket) {
  ok = false;
  console.log(`✗ bucket "recordings" ${bucketError?.message ?? "not found"}`);
} else {
  console.log(`✓ bucket "recordings" ${bucket.public ? "PUBLIC (should be private!)" : "private"}`);
  if (bucket.public) ok = false;
}

// The anon role must not be able to read anything. We don't hold the anon key, so
// instead confirm the REST API rejects an unauthenticated request.
const res = await fetch(
  `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/calls?select=id&limit=1`,
);
console.log(`✓ unauthenticated REST request rejected: ${!res.ok} (HTTP ${res.status})`);
if (res.ok) ok = false;

process.exit(ok ? 0 : 1);
