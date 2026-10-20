import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

/** Processing status, polled by the UI while a call is being transcribed and analyzed. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await db()
    .from("calls")
    .select("id, label, status, failed_stage, error, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  return NextResponse.json(data);
}
