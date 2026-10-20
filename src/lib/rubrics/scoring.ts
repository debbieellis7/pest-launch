import type {
  Grade,
  NaRule,
  RawItemResult,
  Rubric,
  RubricItem,
  ScoredItem,
  ScoringContext,
} from "./types";

export interface EvidenceCheck {
  verified: boolean;
  start: number | null;
}

/** Checks a quote against the transcript; injected so scoring stays pure and testable. */
export type EvidenceVerifier = (quote: string) => EvidenceCheck;

export interface ScoreResult {
  items: ScoredItem[];
  score: number;
  maxScore: number;
  grade: Grade;
  reviewReasons: string[];
}

export function gradeFor(rubric: Rubric, score: number): Grade {
  if (score >= rubric.thresholds.gold) return "gold";
  if (score >= rubric.thresholds.green) return "green";
  return "below";
}

function ruleApplies(rule: NaRule, ctx: ScoringContext): boolean {
  return Boolean(ctx[rule.when]) === (rule.equals ?? true);
}

function applicableNaRule(item: RubricItem, ctx: ScoringContext): NaRule | undefined {
  return item.allowNa?.find((rule) => ruleApplies(rule, ctx));
}

/**
 * Turns the model's per-item judgements into a trustworthy score.
 * The model never decides the total: every point is re-derived here from the
 * rubric rules, and anything inconsistent is corrected and flagged for review.
 */
export function scoreCall(
  rubric: Rubric,
  raw: RawItemResult[],
  ctx: ScoringContext = {},
  verify?: EvidenceVerifier,
): ScoreResult {
  const byId = new Map(raw.map((r) => [r.id, r]));
  const reviewReasons: string[] = [];
  const scored = new Map<string, ScoredItem>();

  for (const item of rubric.items) {
    const result = byId.get(item.id);
    let status = result?.status ?? "not_met";
    let note: string | null = null;

    if (!result) {
      note = "Not assessed by the AI — counted as missed";
      reviewReasons.push(`"${item.label}" was not assessed`);
    }

    const naRule = applicableNaRule(item, ctx);

    if (naRule?.auto && status !== "met") {
      status = "na";
      note = naRule.reason;
    } else if (status === "na") {
      if (naRule) {
        note = naRule.reason;
      } else {
        status = "not_met";
        note = "Marked N/A but the rubric doesn't allow it here — counted as missed";
        reviewReasons.push(`"${item.label}" was marked N/A without a valid reason`);
      }
    }

    if (item.mirrors && ctx[item.mirrors.when]) {
      const mirrored = scored.get(item.mirrors.itemId);
      if (mirrored) {
        status = mirrored.status === "na" ? "met" : mirrored.status;
        note = item.mirrors.reason;
      }
    }

    const evidence = result?.evidence?.trim() || null;
    let evidenceStart: number | null = null;
    let evidenceVerified: boolean | null = null;

    if (status === "met" && !note) {
      if (!evidence) {
        reviewReasons.push(`"${item.label}" marked met without a quote`);
      } else if (verify) {
        const check = verify(evidence);
        evidenceVerified = check.verified;
        evidenceStart = check.start;
        if (!check.verified) {
          reviewReasons.push(`Quote for "${item.label}" wasn't found in the transcript`);
        }
      }
    } else if (evidence && verify) {
      const check = verify(evidence);
      evidenceVerified = check.verified;
      evidenceStart = check.start;
    }

    scored.set(item.id, {
      id: item.id,
      label: item.label,
      quadrant: item.quadrant,
      status,
      earned: status === "met" || status === "na",
      evidence,
      evidenceStart,
      evidenceVerified,
      reason: result?.reason?.trim() || null,
      note,
    });
  }

  const items = rubric.items.map((item) => scored.get(item.id)!);
  const score = items.filter((i) => i.earned).length;

  return {
    items,
    score,
    maxScore: rubric.maxScore,
    grade: gradeFor(rubric, score),
    reviewReasons,
  };
}
