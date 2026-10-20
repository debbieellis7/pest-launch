// Two passes over the transcript:
//   A) classify the call and extract outcome/details (decides which scorecard applies)
//   B) judge each scorecard item with a verbatim quote, and write coaching
// The score itself is computed afterwards in code (scoreCall), never by the model.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod/v4";
import type { Rubric } from "../rubrics/types";
import {
  CLASSIFY_SYSTEM,
  RESEGMENT_SYSTEM,
  classifyUserMessage,
  resegmentUserMessage,
  scoringSystem,
  scoringUserMessage,
} from "./prompts";
import {
  ClassificationSchema,
  ScorecardSchema,
  TurnsSchema,
  normalizeClassification,
  type Classification,
  type Scorecard,
  type Turns,
} from "./schemas";

export const DEFAULT_MODEL = "claude-opus-5-5";

export function analysisModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  // Calls are a few minutes long; one pass rarely takes more than a minute.
  client ??= new Anthropic({ timeout: 4 * 60 * 1000, maxRetries: 2 });
  return client;
}

async function structured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  user: string;
  effort: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  const response = await anthropic().beta.messages.parse({
    model: analysisModel(),
    max_tokens: 16000,
    // Re-run on a fallback model if a safety classifier declines (rare for this content).
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.user }],
    output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      `Model declined to analyze the call (${response.stop_details?.category ?? "no category"})`,
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Analysis was cut off (max_tokens) — the call may be unusually long");
  }
  if (!response.parsed_output)
    throw new Error("Model returned output that didn't match the schema");
  return response.parsed_output as z.infer<S>;
}

export async function splitSpeakers(transcriptText: string): Promise<Turns["turns"]> {
  const { turns } = await structured({
    schema: TurnsSchema,
    system: RESEGMENT_SYSTEM,
    user: resegmentUserMessage(transcriptText),
    effort: "low",
  });
  return turns;
}

export async function classifyCall(
  transcript: string,
  durationSec: number,
): Promise<Classification> {
  const wire = await structured({
    schema: ClassificationSchema,
    system: CLASSIFY_SYSTEM,
    user: classifyUserMessage(transcript, durationSec),
    effort: "medium",
  });
  return normalizeClassification(wire);
}

export function scoreWithRubric(
  rubric: Rubric,
  transcript: string,
  durationSec: number,
  classification: Classification,
): Promise<Scorecard> {
  return structured({
    schema: ScorecardSchema,
    system: scoringSystem(rubric),
    user: scoringUserMessage(transcript, durationSec, classification),
    effort: "high",
  });
}
