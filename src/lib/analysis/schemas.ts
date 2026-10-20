// Output shapes the model must return. They are enforced by the API (structured
// outputs) and re-validated here, so every field the app reads is guaranteed to exist.
// Structured outputs need every key present, so "unknown" is null rather than omitted.
import { z } from "zod/v4";
import { SAVE_OFFERS } from "../rubrics/retention";

const SAVE_OFFER_IDS = SAVE_OFFERS.map((o) => o.id) as [string, ...string[]];

export const CALL_TYPES = ["sales", "service", "billing", "retention", "other"] as const;

export const CANCEL_REASONS = [
  "price",
  "pests_not_resolved",
  "service_experience",
  "moving",
  "financial_hardship",
  "switching_provider",
  "no_longer_needed",
  "deceased",
  "other",
] as const;

export const OBJECTION_TYPES = [
  "price",
  "spouse_or_partner",
  "shopping_around",
  "timing",
  "contract",
  "diy",
  "other",
] as const;

export const RESULTS = [
  "booked",
  "not_booked",
  "follow_up",
  "saved",
  "cancelled",
  "resolved",
  "unresolved",
  "no_outcome",
] as const;

/** Pass A: what kind of call was this, who was on it, and what happened. */
export const ClassificationSchema = z.object({
  rep_speaker: z
    .number()
    .int()
    .nullable()
    .describe("Speaker number of the company employee who handled the call; null if none"),
  rep_name: z.string().nullable().describe("Employee's first name as spoken, e.g. 'Sarah'"),
  caller_name: z.string().nullable().describe("Customer's first name only"),
  company: z.string().nullable().describe("Pest control company name as the rep says it"),

  call_type: z.enum(CALL_TYPES),
  call_subtype: z
    .string()
    .nullable()
    .describe("Short label, e.g. 'new quote', 're-service', 'reschedule', 'card update'"),
  type_confidence: z.number().describe("0 to 1"),
  scorable: z.boolean(),
  unscorable_reason: z
    .string()
    .nullable()
    .describe("Why the call can't be graded, e.g. 'voicemail', 'wrong number'"),

  summary: z.string().describe("2–3 plain sentences an owner can skim"),

  outcome: z.object({
    result: z.enum(RESULTS),
    headline: z.string().describe("One line, e.g. 'Booked quarterly plan — $199 initial, $49/mo'"),
    // Always present (the API caps nullable/union fields at 16); only the section that
    // matches call_type is kept — see normalizeClassification().
    sale: z
      .object({
        service: z.string().nullable(),
        initial_price: z.number().nullable(),
        recurring_price: z.number().nullable(),
        frequency: z.string().nullable(),
        appointment: z.string().nullable().describe("When the first service is, as said"),
        reason_not_booked: z.string().nullable(),
      })
      .describe("Sales calls only; otherwise fill with nulls (ignored)"),
    retention: z
      .object({
        cancel_reason: z.enum(CANCEL_REASONS),
        cancel_reason_detail: z.string(),
        offers_made: z.array(z.enum(SAVE_OFFER_IDS)),
        offer_accepted: z.enum(SAVE_OFFER_IDS).nullable(),
        saved: z.boolean(),
      })
      .describe("Retention calls only; otherwise use 'other', '', [], null, false (ignored)"),
    service: z
      .object({
        request: z.string(),
        resolution: z.string().nullable(),
      })
      .describe("Service and billing calls only; otherwise '' and null (ignored)"),
    next_steps: z.array(z.string()),
  }),

  details: z.object({
    direction: z
      .enum(["inbound", "outbound", "unknown"])
      .describe("inbound = the customer called the company; outbound = the rep called them"),
    customer_status: z.enum(["new", "existing", "unknown"]),
    pests: z.array(z.string()),
    objections: z.array(
      z.object({
        type: z.enum(OBJECTION_TYPES),
        quote: z.string().describe("Customer's words, verbatim"),
        handled: z.boolean(),
      }),
    ),
    sentiment: z.enum(["positive", "neutral", "negative"]),
  }),

  scoring_context: z.object({
    objections_raised: z.boolean(),
    solution_no_cost: z.boolean(),
    simple_transactional: z.boolean(),
    first_offer_accepted: z.boolean(),
    customer_saved: z.boolean(),
    bypass_retention: z.boolean(),
  }),

  review_flags: z
    .array(z.string())
    .describe("Anything a manager should double-check, e.g. 'speakers hard to tell apart'"),
});

/** What the model returns (every outcome section present). */
export type ClassificationWire = z.infer<typeof ClassificationSchema>;

type Outcome = ClassificationWire["outcome"];

/** What the app stores: only the outcome section that matches the call type is kept. */
export type Classification = Omit<ClassificationWire, "outcome"> & {
  outcome: Omit<Outcome, "sale" | "retention" | "service"> & {
    sale: Outcome["sale"] | null;
    retention: Outcome["retention"] | null;
    service: Outcome["service"] | null;
  };
};

export function normalizeClassification(c: ClassificationWire): Classification {
  const t = c.call_type;
  return {
    ...c,
    outcome: {
      ...c.outcome,
      sale: t === "sales" ? c.outcome.sale : null,
      retention: t === "retention" ? c.outcome.retention : null,
      service: t === "service" || t === "billing" ? c.outcome.service : null,
    },
  };
}

/** Pass B: the scorecard judgement for each rubric item, plus coaching. */
export const ScorecardSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      status: z.enum(["met", "not_met", "na"]),
      evidence: z.string().nullable().describe("The rep's exact words from the transcript"),
      reason: z.string().describe("One sentence on why"),
    }),
  ),
  coaching: z.object({
    headline: z.string().describe("One encouraging sentence on the single biggest lever"),
    strengths: z.array(
      z.object({
        item_id: z.string().nullable(),
        what: z.string(),
        quote: z.string().nullable(),
      }),
    ),
    fixes: z.array(
      z.object({
        item_id: z.string(),
        what: z.string().describe("What happened on this call"),
        why: z.string().describe("Why it matters, in the manual's terms"),
        say_this: z.string().describe("A line the rep could have said on this call"),
        at: z.number().nullable().describe("Seconds into the call where it applied"),
      }),
    ),
  }),
});

export type Scorecard = z.infer<typeof ScorecardSchema>;

/** Fallback when diarization failed: the transcript split into speaker turns, verbatim. */
export const TurnsSchema = z.object({
  turns: z.array(
    z.object({
      speaker: z.enum(["rep", "customer", "other"]),
      text: z.string().describe("The exact words from the transcript, in order"),
    }),
  ),
});

export type Turns = z.infer<typeof TurnsSchema>;
