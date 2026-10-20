import { after, NextResponse } from "next/server";
import { claimCall, runClaimed } from "@/lib/pipeline";
import { db } from "@/lib/supabase";

// Transcription + two analysis passes can take a couple of minutes on long calls.
export const maxDuration = 300;

/**
 * Starts (or retries) processing. The call is claimed before responding, so the page the
 * client refreshes into already shows it as processing; the work itself runs after the
 * response and the UI polls the call's status.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { analyzeOnly } = (await req.json().catch(() => ({}))) as { analyzeOnly?: boolean };
  const opts = { analyzeOnly: analyzeOnly === true };

  const { data: call } = await db().from("calls").select("id").eq("id", id).maybeSingle();
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const claimed = await claimCall(id, opts).catch((err) => {
    console.error(`claiming ${id} failed`, err);
    return undefined;
  });
  if (claimed === undefined) {
    return NextResponse.json({ error: "Couldn't start processing. Try again." }, { status: 500 });
  }
  if (!claimed) {
    return NextResponse.json({ error: "This call is already being processed." }, { status: 409 });
  }

  after(() =>
    runClaimed(claimed, opts).catch((err) => console.error(`processing ${id} failed`, err)),
  );
  return NextResponse.json({ ok: true }, { status: 202 });
}
