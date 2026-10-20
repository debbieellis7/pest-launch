import { allCallsRubric } from "./allCalls";
import { retentionRubric } from "./retention";
import { salesRubric } from "./sales";
import type { Rubric, RubricId } from "./types";

export * from "./types";
export { gradeFor, scoreCall } from "./scoring";
export type { EvidenceCheck, EvidenceVerifier, ScoreResult } from "./scoring";
export { SAVE_OFFERS } from "./retention";
export { allCallsRubric, retentionRubric, salesRubric };

export type CallType = "sales" | "service" | "billing" | "retention" | "other";

export const CALL_TYPES: CallType[] = ["sales", "service", "billing", "retention", "other"];

export const RUBRICS: Record<RubricId, Rubric> = {
  sales: salesRubric,
  all_calls: allCallsRubric,
  retention: retentionRubric,
};

/** Which scorecard applies to a call (null = not scorable, shown as N/A). */
export function rubricFor(callType: CallType, scorable: boolean): Rubric | null {
  if (!scorable) return null;
  if (callType === "sales") return salesRubric;
  if (callType === "retention") return retentionRubric;
  return allCallsRubric;
}

export const GRADE_LABEL = {
  gold: "Gold Standard",
  green: "Green Standard",
  below: "Below Standard",
} as const;
