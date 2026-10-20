import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CallLimitError,
  DuplicateCallError,
  MAX_UPLOAD_BYTES,
  createCall,
  extensionOf,
  signedUploadUrl,
} from "@/lib/calls";

const Body = z.object({
  filename: z.string().min(1).max(200),
  size: z.number().int().positive(),
});

/**
 * Step 1 of an upload: create the call and return a one-time URL the browser PUTs the
 * audio to (straight into private storage, so large files skip the server's body limit).
 * Step 2 is POST /api/calls/[id]/process.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { filename, size } = parsed.data;
  if (!extensionOf(filename)) {
    return NextResponse.json(
      { error: "Upload an MP3, WAV, M4A or AAC recording" },
      { status: 400 },
    );
  }
  if (size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Recordings must be 50 MB or smaller" }, { status: 400 });
  }

  try {
    const { id, storagePath } = await createCall(filename);
    return NextResponse.json({ id, uploadUrl: await signedUploadUrl(storagePath) });
  } catch (err) {
    if (err instanceof DuplicateCallError) {
      return NextResponse.json({ error: err.message, existingId: err.existingId }, { status: 409 });
    }
    if (err instanceof CallLimitError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("create call failed", err);
    return NextResponse.json({ error: "Couldn't start the upload. Try again." }, { status: 500 });
  }
}
