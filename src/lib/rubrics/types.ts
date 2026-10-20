export type Quadrant = "validation" | "understand" | "solve" | "verify";

export type ItemStatus = "met" | "not_met" | "na";

export type RubricId = "sales" | "all_calls" | "retention";

export type Grade = "gold" | "green" | "below";

/**
 * Facts about the call (extracted in analysis pass A) that decide which
 * rubric items may legitimately be N/A.
 */
export interface ScoringContext {
  /** Sales: did the customer raise any objection (price, spouse, shopping around...)? */
  objectionsRaised?: boolean;
  /** All Calls: did the solution cost the customer nothing (re-service, reschedule, card update)? */
  solutionNoCost?: boolean;
  /** All Calls: a simple scheduling / card-update call where "Understand" is less applicable. */
  simpleTransactional?: boolean;
  /** Retention: the customer accepted the first save offer. */
  firstOfferAccepted?: boolean;
  /** Retention: the customer was saved (did not cancel). */
  customerSaved?: boolean;
  /** Retention: moving out of the service area or customer passed away — manual allows bypassing steps. */
  bypassRetention?: boolean;
}

/** A named condition under which an item may be marked N/A and still earn its point. */
export interface NaRule {
  when: keyof ScoringContext;
  /** true = the context flag must be true; false = it must be false. Defaults to true. */
  equals?: boolean;
  /** Shown in the UI next to the item, e.g. "No objections raised". */
  reason: string;
  /**
   * true = when the condition holds the point is awarded regardless of what the
   * model said (e.g. Sales objections when none were raised — the manual says
   * "automatically gets 4 points"). false = only honoured if the model marked N/A.
   */
  auto?: boolean;
}

export interface RubricItem {
  id: string;
  label: string;
  quadrant: Quadrant;
  /** What the manual says this step is, used to brief the scorer. */
  definition: string;
  /** Example phrasings straight from the manual. */
  examples: string[];
  /** Conditions under which N/A is allowed (and counts as earned). */
  allowNa?: NaRule[];
  /** If set, this item's status mirrors another item's when a context flag holds. */
  mirrors?: { itemId: string; when: keyof ScoringContext; reason: string };
}

export interface Rubric {
  id: RubricId;
  version: string;
  name: string;
  maxScore: number;
  /** Gold = exactly maxScore; Green = score >= green; else Below Standard. */
  thresholds: { gold: number; green: number };
  items: RubricItem[];
}

/** One item result as returned by the model (before validation). */
export interface RawItemResult {
  id: string;
  status: ItemStatus;
  evidence?: string | null;
  reason?: string | null;
}

/** One item result after validation and scoring, as stored in analyses.items. */
export interface ScoredItem {
  id: string;
  label: string;
  quadrant: Quadrant;
  status: ItemStatus;
  earned: boolean;
  evidence: string | null;
  evidenceStart: number | null;
  evidenceVerified: boolean | null;
  reason: string | null;
  /** Why the status was set or changed by code (auto-awarded, mirrored, corrected). */
  note: string | null;
}
