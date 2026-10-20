// Verifies env vars are present and keys work. Prints only set/missing + HTTP status — never values.
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const names = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_PASSWORD",
  "SESSION_SECRET",
  "DEEPGRAM_API_KEY",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
];
for (const n of names) console.log(`${n.padEnd(26)} ${process.env[n] ? "set" : "MISSING"}`);
const s = process.env.SESSION_SECRET || "";
console.log(`SESSION_SECRET length ok (>=32): ${s.length >= 32}`);
try {
  const r = await fetch("https://api.deepgram.com/v1/projects", {
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
  });
  console.log(`Deepgram key accepted: ${r.ok} (HTTP ${r.status})`);
} catch {
  console.log("Deepgram check failed: network error");
}
try {
  const u = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const r = await fetch(`${u}/storage/v1/bucket`, {
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  const body = r.ok ? await r.json() : [];
  console.log(
    `Supabase service key accepted: ${r.ok} (HTTP ${r.status}); buckets: ${Array.isArray(body) ? body.length : "?"}`,
  );
} catch {
  console.log("Supabase check failed: network error or bad URL");
}
