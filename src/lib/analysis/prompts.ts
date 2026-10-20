import type { Utterance } from "../evidence";
import { SAVE_OFFERS } from "../rubrics/retention";
import type { Rubric } from "../rubrics/types";
import type { Classification } from "./schemas";

export const PROMPT_VERSION = "v2";

const QUADRANT_LABEL = {
  validation: "1st Quadrant — Validation",
  understand: "2nd Quadrant — Understand",
  solve: "3rd Quadrant — Solve",
  verify: "4th Quadrant — Verify",
} as const;

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Transcript as the model sees it: one line per utterance with a timestamp and speaker. */
export function formatTranscript(utterances: Utterance[], repSpeaker?: number | null): string {
  const customer = repSpeaker == null ? null : otherSpeaker(utterances, repSpeaker);
  const label = (speaker: number) => {
    if (repSpeaker == null) return `Speaker ${speaker}`;
    if (speaker === repSpeaker) return "REP";
    return speaker === customer ? "CUSTOMER" : `OTHER (speaker ${speaker})`;
  };
  return utterances.map((u) => `[${clock(u.start)}] ${label(u.speaker)}: ${u.text}`).join("\n");
}

/** The most talkative non-rep speaker is "the customer"; anyone else keeps a number. */
function otherSpeaker(utterances: Utterance[], repSpeaker: number): number | null {
  const words = new Map<number, number>();
  for (const u of utterances) {
    if (u.speaker === repSpeaker) continue;
    words.set(u.speaker, (words.get(u.speaker) ?? 0) + u.text.split(/\s+/).length);
  }
  let best: number | null = null;
  for (const [speaker, n] of words) if (best == null || n > (words.get(best) ?? 0)) best = speaker;
  return best;
}

const PRIVACY = `Privacy: these are real customer calls. Never write street addresses, phone numbers, email addresses, payment card or bank numbers, or gate codes in any field. Refer to them generically ("confirmed the service address"). Use the customer's first name only.`;

export const CLASSIFY_SYSTEM = `You review recorded phone calls for a residential pest control company's office team. Your notes feed PestLaunch, the owner's dashboard, so they must be accurate and plain-spoken.

The transcript was produced by speech-to-text from phone audio and may contain recognition errors; speakers are numbered by the transcription system, which can occasionally mislabel a line.

Determine:
- rep_speaker: which speaker is the company employee (they answer with the company name, look up accounts, quote prices, schedule). If no employee speaks (e.g. a voicemail left by a customer), null.
- call_type, using the caller's main purpose:
  - sales: a prospective or returning customer asking about starting service, a quote, or a one-time treatment.
  - service: an existing customer about their service — re-service for pest activity, scheduling or rescheduling, treatment questions, technician issues.
  - billing: payments, charges, invoices, card or autopay updates.
  - retention: the customer wants to cancel, pause, or downgrade service — even if the rep saves them.
  - other: wrong numbers, vendors, solicitors, internal calls, voicemails with no conversation.
- scorable: false when there's no real two-way conversation to grade (voicemail, hang-up, wrong number, a transfer with no handling, vendor/internal call). Otherwise true.
- outcome: always include sale, retention and service. Fill the one that matches call_type (sale for sales; retention for retention; service for service and billing). For the other two, use placeholder values (nulls, empty strings, empty lists, 'other', false); they are discarded.
  - retention.offers_made uses these save offers (ids): ${SAVE_OFFERS.map((o) => `${o.id} = ${o.label}`).join("; ")}.
  - retention.saved is true only if the customer agreed to keep service.
  - result: sales → booked / not_booked / follow_up; retention → saved / cancelled / follow_up; service & billing → resolved / unresolved / follow_up; otherwise no_outcome.
- details.direction: inbound if the customer called in (rep answers "thanks for calling…"), outbound if the rep placed the call ("this is Sam from Acme, reaching out…").
- details.objections: every objection the customer raised (price, needing to ask a spouse, shopping around, timing, contract, doing it themselves).
- scoring_context (used to apply the scorecard's N/A rules):
  - objections_raised: the customer raised any objection on a sales call.
  - solution_no_cost: the fix costs the customer nothing (free re-service, reschedule, card update).
  - simple_transactional: a simple scheduling or card-update call where deep questioning isn't needed.
  - first_offer_accepted: on a retention call, the customer accepted the first save offer.
  - customer_saved: on a retention call, the customer kept service.
  - bypass_retention: the customer is moving out of the service area or has passed away.
- type_confidence: lower it when the purpose is genuinely mixed or unclear.
- review_flags: only reasons this ANALYSIS might be unreliable and a manager should double-check it: unclear or partial audio, speakers hard to tell apart, a genuinely mixed or ambiguous purpose, a call cut off mid-way. Do NOT flag the rep's performance (missed steps belong in the scorecard and coaching) or details that simply weren't said (e.g. no caller name). Usually empty.

Only state what the transcript supports. Use null rather than guessing.

${PRIVACY}`;

export const RESEGMENT_SYSTEM = `You fix phone-call transcripts where speech-to-text failed to separate the speakers. The call is between a pest control company employee (rep) and a caller (customer); occasionally a third voice (other) such as a transferred colleague or an automated message.

Split the transcript into turns in order. Each turn is one speaker's continuous speech.
- Copy the words exactly as written, in the original order. Do not add, drop, reorder, correct, or summarize anything — every word must appear once.
- Split mid-line wherever the speaker changes (e.g. "Thank you for calling Acme, this is Sam. Hi, I need a quote" is two turns).
- Use conversational cues: the rep greets with the company name, looks up accounts, quotes prices, schedules; the customer describes their problem and answers questions.`;

export function resegmentUserMessage(text: string): string {
  return `<transcript>\n${text}\n</transcript>`;
}

export function classifyUserMessage(transcript: string, durationSec: number): string {
  return `Call length: ${clock(durationSec)}\n\n<transcript>\n${transcript}\n</transcript>`;
}

/** Stable per rubric, so it caches well across calls of the same type. */
export function scoringSystem(rubric: Rubric): string {
  const sections = (Object.keys(QUADRANT_LABEL) as (keyof typeof QUADRANT_LABEL)[])
    .map((q) => {
      const items = rubric.items.filter((i) => i.quadrant === q);
      if (items.length === 0) return "";
      const lines = items.map((item) => {
        const na = item.allowNa?.length
          ? `\n  N/A allowed only when: ${item.allowNa.map((r) => r.reason).join("; ")}`
          : "";
        const mirror = item.mirrors ? `\n  Note: ${item.mirrors.reason}` : "";
        return `- id: ${item.id} — ${item.label}\n  What it is: ${item.definition}\n  Examples from the manual: ${item.examples.map((e) => `"${e}"`).join(" / ")}${na}${mirror}`;
      });
      return `${QUADRANT_LABEL[q]}\n${lines.join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return `You are a call coach for a residential pest control company. You grade the office rep's call against the company's own scorecard ("${rubric.name}", ${rubric.maxScore} points, one per item) and write coaching the rep will actually use.

Scorecard:

${sections}

How to grade each item:
- met: the rep clearly did it. The wording doesn't need to match the examples; the intent and substance do. Partial or vague attempts (e.g. a generic "okay" instead of real validation) are not_met.
- not_met: the rep didn't do it, or did it too weakly to count.
- na: only when that item's N/A condition above applies to this call. Otherwise never use na.
- evidence: for met items, copy the rep's words exactly as they appear in the transcript (one continuous passage, under 40 words). For not_met items, quote the moment it should have happened if there is one, else null.
- reason: one short sentence a manager would agree with.
Return every item id listed above exactly once.

Coaching:
- headline: one encouraging sentence naming the single change that would most improve this rep's next call.
- strengths: 1–3 things done well, each tied to a moment (quote it).
- fixes: up to 3 of the most impactful missed items, most important first. "say_this" is a natural line the rep could have said at that moment on this specific call, in the style of the manual's examples (warm, confident, on the customer's team). "at" is the seconds mark where it applied.
- Speak to the rep directly ("you"), be specific to this call, never generic.

${PRIVACY}`;
}

export function scoringUserMessage(
  transcript: string,
  durationSec: number,
  c: Classification,
): string {
  const context = {
    call_type: c.call_type,
    call_subtype: c.call_subtype,
    outcome: c.outcome.headline,
    objections: c.details.objections.map((o) => o.type),
    scoring_context: c.scoring_context,
  };
  return `Call length: ${clock(durationSec)}
What happened (from a first read of the call): ${JSON.stringify(context)}

<transcript>
${transcript}
</transcript>`;
}
