// Turns the model's two passes into the trusted analyses row. Pure, so it's unit-tested.
import { verifyQuote, type Utterance } from "../evidence";
import { rubricFor, scoreCall, type Rubric, type ScoringContext } from "../rubrics";
import type { Classification, Scorecard } from "./schemas";

export const LOW_TYPE_CONFIDENCE = 0.7;

export function toScoringContext(c: Classification): ScoringContext {
  const s = c.scoring_context;
  return {
    objectionsRaised: s.objections_raised || c.details.objections.length > 0,
    solutionNoCost: s.solution_no_cost,
    simpleTransactional: s.simple_transactional,
    firstOfferAccepted: s.first_offer_accepted,
    customerSaved: s.customer_saved,
    bypassRetention: s.bypass_retention,
  };
}

/** Which scorecard (if any) this call should be graded on. */
export function rubricForClassification(c: Classification): Rubric | null {
  return rubricFor(c.call_type, c.scorable && c.rep_speaker != null);
}

export function buildAnalysis(
  c: Classification,
  rubric: Rubric | null,
  scorecard: Scorecard | null,
  utterances: Utterance[],
) {
  const reviewReasons = [...c.review_flags];
  if (c.type_confidence < LOW_TYPE_CONFIDENCE) reviewReasons.push("Call type is uncertain");
  if (c.scorable && c.rep_speaker == null)
    reviewReasons.push("Couldn't tell which speaker is the rep");

  let items: unknown[] = [];
  let score: number | null = null;
  let maxScore: number | null = null;
  let grade: string | null = null;
  let coaching: Record<string, unknown> = {};

  if (rubric && scorecard) {
    const result = scoreCall(rubric, scorecard.items, toScoringContext(c), (quote) =>
      verifyQuote(quote, utterances),
    );
    reviewReasons.push(...result.reviewReasons);
    items = result.items;
    score = result.score;
    maxScore = result.maxScore;
    grade = result.grade;

    // Point each fix at a moment in the audio: the model's mark, else the item's quote.
    const startById = new Map(result.items.map((i) => [i.id, i.evidenceStart]));
    coaching = {
      ...scorecard.coaching,
      fixes: scorecard.coaching.fixes.map((f) => ({
        ...f,
        at: f.at ?? startById.get(f.item_id) ?? null,
      })),
    };
  }

  return {
    rep_name: c.rep_name,
    company: c.company,
    caller_name: c.caller_name,
    call_type: c.call_type,
    call_subtype: c.call_subtype,
    type_confidence: Math.round(Math.min(1, Math.max(0, c.type_confidence)) * 1000) / 1000,
    scorable: c.scorable && rubric != null,
    unscorable_reason: rubric
      ? null
      : (c.unscorable_reason ?? (c.scorable ? "No rep identified" : null)),
    summary: c.summary,
    outcome: c.outcome,
    details: c.details,
    rubric_id: rubric?.id ?? null,
    rubric_version: rubric?.version ?? null,
    items,
    score,
    max_score: maxScore,
    grade,
    coaching,
    needs_review: reviewReasons.length > 0,
    review_reasons: [...new Set(reviewReasons)],
  };
}
