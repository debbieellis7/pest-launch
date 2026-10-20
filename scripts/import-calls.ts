// Bulk-loads recordings from a local folder through the same pipeline the app uses.
// Prints only labels, call types, grades and timings — never transcript or customer details.
//
//   npm run import:calls -- [folder] [--only=CALL-001,CALL-015] [--reanalyze] [--force] [--concurrency=3]
//
//   --reanalyze   reuse stored transcripts and only re-run analysis (after prompt changes)
//   --force       re-run calls that already completed
import { loadEnvConfig } from "@next/env";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

const DEFAULT_DIR = "../drive/02 — Call Recordings (20)";

async function main() {
  // Imported after env is loaded.
  const { AUDIO_TYPES, createCall, extensionOf, labelFromFilename, maxCalls } =
    await import("../src/lib/calls");
  const { processCall } = await import("../src/lib/pipeline");
  const { RECORDINGS_BUCKET, db } = await import("../src/lib/supabase");

  const args = process.argv.slice(2);
  const flag = (name: string) => args.find((a) => a.startsWith(`--${name}`));
  const dir = path.resolve(args.find((a) => !a.startsWith("--")) ?? DEFAULT_DIR);
  const only = flag("only")
    ?.split("=")[1]
    ?.split(",")
    .map((s) => s.trim().toUpperCase());
  const reanalyze = Boolean(flag("reanalyze"));
  const force = Boolean(flag("force"));
  const concurrency = Number(flag("concurrency")?.split("=")[1] ?? 3);

  let files = (await readdir(dir))
    .filter((f) => extensionOf(f))
    .sort()
    .filter((f) => !only || only.includes(labelFromFilename(f)));
  if (files.length === 0) {
    console.log(`No recordings found in ${dir}`);
    return;
  }

  const supabase = db();
  const { data: existing, error } = await supabase
    .from("calls")
    .select("id, label, status, transcripts(call_id)");
  if (error) throw new Error(error.message);
  const byLabel = new Map(existing.map((c) => [c.label as string, c]));

  // Respect the demo's call limit up front (workers run in parallel, so don't rely on
  // the per-call check alone): only import as many new recordings as there are free slots.
  const limit = maxCalls();
  const slots = Math.max(0, limit - existing.length);
  const newFiles = files.filter((f) => !byLabel.has(labelFromFilename(f)));
  const dropped = new Set(newFiles.slice(slots));
  if (dropped.size) {
    console.log(
      `Limit is ${limit} calls (MAX_CALLS) and ${existing.length} exist, so ${dropped.size} new recording(s) will be skipped:`,
    );
    console.log(`  ${[...dropped].map(labelFromFilename).join(", ")}\n`);
    files = files.filter((f) => !dropped.has(f));
  }

  console.log(`${files.length} recording(s) from ${dir}\n`);
  const queue = [...files];
  let failures = 0;

  async function worker() {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const label = labelFromFilename(file);
      const started = Date.now();
      try {
        const found = byLabel.get(label);
        const hasTranscript = Boolean(found?.transcripts);
        let id: string;

        if (found && found.status === "complete" && !force && !reanalyze) {
          console.log(`${label}  skipped (already complete — use --force or --reanalyze)`);
          continue;
        }
        if (found) {
          id = found.id;
        } else {
          const created = await createCall(file);
          id = created.id;
          const body = await readFile(path.join(dir, file));
          const { error: upErr } = await supabase.storage
            .from(RECORDINGS_BUCKET)
            .upload(created.storagePath, body, { contentType: AUDIO_TYPES[extensionOf(file)!] });
          if (upErr) throw new Error(`upload failed: ${upErr.message}`);
        }

        await processCall(id, {
          analyzeOnly: (reanalyze || found?.status === "failed") && hasTranscript,
        });
        const { data } = await supabase
          .from("analyses")
          .select("call_type, scorable, score, max_score, grade, needs_review")
          .eq("call_id", id)
          .single();
        const secs = ((Date.now() - started) / 1000).toFixed(0);
        const score = data?.scorable
          ? `${data.score}/${data.max_score} ${data.grade}`
          : "not scored";
        console.log(
          `${label}  ✓ ${data?.call_type ?? "?"}  ${score}${data?.needs_review ? "  (needs review)" : ""}  ${secs}s`,
        );
      } catch (err) {
        failures++;
        console.log(`${label}  ✗ ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  console.log(`\nDone. ${files.length - failures} ok, ${failures} failed.`);
  if (failures) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
