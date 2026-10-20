// Turns analyzed calls into the answers an owner asks for: are we closing, are we
// saving cancels and why not, what should I train on, who needs a call back, and how
// each rep is doing. Pure (no I/O), so it's unit-tested.
import { CANCEL_REASON_LABEL, offerLabel, type CallType, type Grade } from "./format";
import type { CallSummary } from "./queries";
import { RUBRICS } from "./rubrics";
import type { RubricId } from "./rubrics/types";

type Analyzed = CallSummary & { analysis: NonNullable<CallSummary["analysis"]> };

export interface MissedStep {
  rubricId: RubricId;
  itemId: string;
  label: string;
  rubricName: string;
  missed: number;
  graded: number;
  rate: number;
  examples: { id: string; label: string }[];
}

export interface FollowUp {
  id: string;
  label: string;
  callType: CallType;
  result: string;
  headline: string | null;
  repName: string | null;
  callerName: string | null;
  nextSteps: string[];
  priority: number;
}

export interface BiggestIssue {
  title: string;
  metric: string;
  detail: string;
  href: string;
  tone: "bad" | "good";
}

export interface Insights {
  totals: {
    calls: number;
    analyzed: number;
    graded: number;
    needsReview: number;
    /** Analyzed calls from people who aren't customers yet. */
    newLeads: number;
  };
  sales: {
    calls: number;
    decided: number;
    booked: number;
    closeRate: number | null;
    bookedInitial: number;
    bookedRecurring: number;
  };
  retention: {
    calls: number;
    decided: number;
    saved: number;
    saveRate: number | null;
    lostReasons: { reason: string; label: string; count: number; unavoidable: boolean }[];
    winningOffers: { offer: string; label: string; count: number }[];
  };
  service: { calls: number; resolved: number; decided: number; resolveRate: number | null };
  scores: {
    rubricId: RubricId;
    name: string;
    calls: number;
    avg: number;
    max: number;
    pct: number;
  }[];
  gradeMix: Record<Grade, number>;
  missedSteps: MissedStep[];
  followUps: FollowUp[];
  biggestIssue: BiggestIssue | null;
}

const rate = (num: number, den: number) => (den > 0 ? num / den : null);

const UNSAVEABLE = new Set(["moving", "deceased"]);

/** A coaching gap needs this many graded calls before it can be the headline issue. */
const MIN_CALLS_FOR_STEP_ISSUE = 3;
/** Same short names the Reps page uses ("All Calls scorecard"). */
const SCORECARD_SHORT_NAME: Record<string, string> = {
  sales: "Sales",
  retention: "Retention",
  all_calls: "All Calls",
};

/** A close or save rate needs this many decided calls; one lost call isn't a trend. */
const MIN_CALLS_FOR_RATE_ISSUE = 2;

function analyzed(calls: CallSummary[]): Analyzed[] {
  return calls.filter((c): c is Analyzed => c.status === "complete" && c.analysis != null);
}

/** Most-missed scorecard steps across graded calls (N/A doesn't count as a miss). */
export function missedSteps(calls: Analyzed[], minGraded = 2): MissedStep[] {
  const stats = new Map<string, MissedStep>();
  for (const c of calls) {
    const rubricId = c.analysis.rubricId as RubricId | null;
    if (!rubricId || !RUBRICS[rubricId] || c.analysis.grade == null) continue;
    for (const item of c.analysis.items) {
      if (item.status === "na") continue;
      const key = `${rubricId}:${item.id}`;
      const s =
        stats.get(key) ??
        ({
          rubricId,
          itemId: item.id,
          label: item.label,
          rubricName: RUBRICS[rubricId].name,
          missed: 0,
          graded: 0,
          rate: 0,
          examples: [],
        } satisfies MissedStep);
      s.graded++;
      if (!item.earned) {
        s.missed++;
        if (s.examples.length < 3) s.examples.push({ id: c.id, label: c.label });
      }
      stats.set(key, s);
    }
  }
  return [...stats.values()]
    .map((s) => ({ ...s, rate: s.missed / s.graded }))
    .filter((s) => s.graded >= minGraded && s.missed > 0)
    .sort((a, b) => b.rate - a.rate || b.missed - a.missed);
}

const FOLLOW_UP_PRIORITY: Record<string, number> = {
  follow_up: 0, // still winnable
  not_booked: 1,
  unresolved: 2,
  cancelled: 3, // win-back
};

/** Calls where money or a customer is still on the table. */
export function followUps(calls: Analyzed[]): FollowUp[] {
  return calls
    .filter((c) => c.analysis.result != null && c.analysis.result in FOLLOW_UP_PRIORITY)
    .map((c) => ({
      id: c.id,
      label: c.label,
      callType: c.analysis.callType,
      result: c.analysis.result!,
      headline: c.analysis.headline,
      repName: c.analysis.repName,
      callerName: c.analysis.callerName,
      nextSteps: c.analysis.outcome?.next_steps ?? [],
      priority:
        FOLLOW_UP_PRIORITY[c.analysis.result!] + (c.analysis.callType === "sales" ? 0 : 0.5),
    }))
    .sort(
      (a, b) => a.priority - b.priority || a.label.localeCompare(b.label, "en", { numeric: true }),
    );
}

function countBy<T>(values: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function buildInsights(all: CallSummary[]): Insights {
  const calls = analyzed(all);
  const ofType = (t: CallType) => calls.filter((c) => c.analysis.callType === t);

  // Sales: close rate over calls that reached a decision (booked / not booked / follow-up).
  const sales = ofType("sales");
  const salesDecided = sales.filter((c) =>
    ["booked", "not_booked", "follow_up"].includes(c.analysis.result ?? ""),
  );
  const booked = sales.filter((c) => c.analysis.result === "booked");

  // Retention: save rate, why we lost the rest, and which offers worked. Moving out of
  // the area or a customer passing away can't be saved (the manual lets reps bypass the
  // save steps), so those don't count against the save rate.
  const retention = ofType("retention");
  const unavoidable = (c: Analyzed) =>
    UNSAVEABLE.has(c.analysis.outcome?.retention?.cancel_reason ?? "");
  const retentionDecided = retention.filter(
    (c) => ["saved", "cancelled", "follow_up"].includes(c.analysis.result ?? "") && !unavoidable(c),
  );
  const saved = retention.filter(
    (c) => c.analysis.outcome?.retention?.saved || c.analysis.result === "saved",
  );
  const lost = retention.filter((c) => c.analysis.result === "cancelled" && !saved.includes(c));
  const lostReasons = [
    ...countBy(lost.map((c) => c.analysis.outcome?.retention?.cancel_reason ?? "other")),
  ]
    .map(([reason, count]) => ({
      reason,
      label: CANCEL_REASON_LABEL[reason] ?? reason,
      count,
      unavoidable: UNSAVEABLE.has(reason),
    }))
    .sort((a, b) => Number(a.unavoidable) - Number(b.unavoidable) || b.count - a.count);
  const winningOffers = [
    ...countBy(
      saved
        .map((c) => c.analysis.outcome?.retention?.offer_accepted)
        .filter((o): o is string => Boolean(o)),
    ),
  ]
    .map(([offer, count]) => ({ offer, label: offerLabel(offer), count }))
    .sort((a, b) => b.count - a.count);

  // Customer service: service + billing calls.
  const service = [...ofType("service"), ...ofType("billing")];
  const serviceDecided = service.filter((c) =>
    ["resolved", "unresolved", "follow_up"].includes(c.analysis.result ?? ""),
  );
  const resolved = service.filter((c) => c.analysis.result === "resolved");

  const graded = calls.filter(
    (c) => c.analysis.grade && c.analysis.score != null && c.analysis.maxScore,
  );
  const scores = (Object.keys(RUBRICS) as RubricId[])
    .map((rubricId) => {
      const group = graded.filter((c) => c.analysis.rubricId === rubricId);
      const avg =
        group.reduce((s, c) => s + (c.analysis.score ?? 0), 0) / Math.max(1, group.length);
      const max = RUBRICS[rubricId].maxScore;
      return {
        rubricId,
        name: RUBRICS[rubricId].name,
        calls: group.length,
        avg,
        max,
        pct: avg / max,
      };
    })
    .filter((s) => s.calls > 0);

  const gradeMix: Record<Grade, number> = { gold: 0, green: 0, below: 0 };
  for (const c of graded) gradeMix[c.analysis.grade!]++;

  const insights: Insights = {
    totals: {
      calls: all.length,
      analyzed: calls.length,
      graded: graded.length,
      needsReview: calls.filter((c) => c.analysis.needsReview).length,
      newLeads: calls.filter((c) => c.analysis.customerStatus === "new").length,
    },
    sales: {
      calls: sales.length,
      decided: salesDecided.length,
      booked: booked.length,
      closeRate: rate(booked.length, salesDecided.length),
      bookedInitial: booked.reduce((s, c) => s + (c.analysis.outcome?.sale?.initial_price ?? 0), 0),
      bookedRecurring: booked.reduce(
        (s, c) => s + (c.analysis.outcome?.sale?.recurring_price ?? 0),
        0,
      ),
    },
    retention: {
      calls: retention.length,
      decided: retentionDecided.length,
      saved: saved.length,
      saveRate: rate(saved.length, retentionDecided.length),
      lostReasons,
      winningOffers,
    },
    service: {
      calls: service.length,
      resolved: resolved.length,
      decided: serviceDecided.length,
      resolveRate: rate(resolved.length, serviceDecided.length),
    },
    scores,
    gradeMix,
    missedSteps: missedSteps(calls),
    followUps: followUps(calls),
    biggestIssue: null,
  };
  insights.biggestIssue = biggestIssue(insights);
  return insights;
}

/**
 * The single thing most worth the owner's attention, like PestLaunch's
 * "Biggest financial issue" card. Each candidate's severity is how far it falls
 * short (0–1); the worst one wins.
 */
export function biggestIssue(i: Insights): BiggestIssue | null {
  const candidates: (BiggestIssue & { severity: number })[] = [];

  if (
    i.retention.saveRate != null &&
    i.retention.saveRate < 0.6 &&
    i.retention.decided >= MIN_CALLS_FOR_RATE_ISSUE
  ) {
    const top = i.retention.lostReasons.find((r) => !r.unavoidable);
    candidates.push({
      severity: 1 - i.retention.saveRate,
      title: "Cancellations aren't being saved",
      metric: `${i.retention.saved} of ${i.retention.decided} saved`,
      detail: top
        ? `Top reason customers left: ${top.label.toLowerCase()}.`
        : "Review the retention calls below.",
      href: "/sales/calls?type=retention",
      tone: "bad",
    });
  }
  if (
    i.sales.closeRate != null &&
    i.sales.closeRate < 0.5 &&
    i.sales.decided >= MIN_CALLS_FOR_RATE_ISSUE
  ) {
    candidates.push({
      severity: 1 - i.sales.closeRate,
      title: "Sales calls aren't closing",
      metric: `${i.sales.booked} of ${i.sales.decided} booked`,
      detail: "Most sales calls end without an appointment on the calendar.",
      href: "/sales/calls?type=sales",
      tone: "bad",
    });
  }
  const step = i.missedSteps[0];
  if (step && step.rate >= 0.6 && step.graded >= MIN_CALLS_FOR_STEP_ISSUE) {
    candidates.push({
      severity: step.rate * 0.9, // a coaching gap matters slightly less than lost revenue
      title: `Reps are skipping “${step.label}”`,
      metric: `Missed on ${step.missed} of ${step.graded} calls`,
      detail: `The most-missed step on the ${SCORECARD_SHORT_NAME[step.rubricId]} scorecard. Start coaching here.`,
      href: `/sales/calls/${step.examples[0].id}`,
      tone: "bad",
    });
  }
  if (i.totals.graded >= 3 && i.gradeMix.below / i.totals.graded >= 0.5) {
    candidates.push({
      severity: (i.gradeMix.below / i.totals.graded) * 0.8,
      title: "Most calls are below standard",
      metric: `${i.gradeMix.below} of ${i.totals.graded} below standard`,
      detail: "Fewer than half of graded calls are on standard.",
      href: "/sales/calls",
      tone: "bad",
    });
  }

  if (candidates.length === 0) {
    if (i.totals.graded === 0) return null;
    const onStandard = i.gradeMix.gold + i.gradeMix.green;
    // Too few calls to name a problem, but not good enough to call "on standard": show nothing.
    if (onStandard / i.totals.graded < 0.5) return null;
    return {
      title: "Your team is on standard",
      metric: `${onStandard} of ${i.totals.graded} calls on standard`,
      detail: `Close rate ${i.sales.closeRate == null ? "—" : pct(i.sales.closeRate)}, save rate ${
        i.retention.saveRate == null ? "—" : pct(i.retention.saveRate)
      }.`,
      href: "/sales/calls",
      tone: "good",
    };
  }
  const { severity: _severity, ...worst } = candidates.sort((a, b) => b.severity - a.severity)[0];
  return worst;
}

export interface RepStats {
  name: string;
  calls: number;
  graded: number;
  avgPct: number | null;
  gradeMix: Record<Grade, number>;
  closeRate: number | null;
  saveRate: number | null;
  topMissed: MissedStep[];
  bestCallId: string | null;
  needsReview: number;
  /** This rep's calls still needing follow-up (not booked, not saved, unresolved). */
  followUps: number;
}

/** One row per rep, best average first; calls without an identified rep are left out. */
export function repStats(all: CallSummary[]): RepStats[] {
  const calls = analyzed(all);
  const names = [
    ...new Set(calls.map((c) => c.analysis.repName).filter((n): n is string => Boolean(n))),
  ];
  return names
    .map((name) => {
      const mine = calls.filter((c) => c.analysis.repName === name);
      const i = buildInsights(mine);
      const graded = mine.filter((c) => c.analysis.grade && c.analysis.maxScore);
      const pcts = graded.map((c) => (c.analysis.score ?? 0) / (c.analysis.maxScore ?? 1));
      const best = [...graded].sort(
        (a, b) =>
          (b.analysis.score ?? 0) / (b.analysis.maxScore ?? 1) -
          (a.analysis.score ?? 0) / (a.analysis.maxScore ?? 1),
      )[0];
      return {
        name,
        calls: mine.length,
        graded: graded.length,
        avgPct: pcts.length ? pcts.reduce((s, p) => s + p, 0) / pcts.length : null,
        gradeMix: i.gradeMix,
        closeRate: i.sales.closeRate,
        saveRate: i.retention.saveRate,
        topMissed: missedSteps(mine, 1).slice(0, 2),
        bestCallId: best?.id ?? null,
        needsReview: i.totals.needsReview,
        followUps: i.followUps.length,
      };
    })
    .sort((a, b) => (b.avgPct ?? -1) - (a.avgPct ?? -1) || b.calls - a.calls);
}

// ---------------------------------------------------------------------------
// Date range (the 7d / 30d toggle on every Sales tab)
// ---------------------------------------------------------------------------

export type Range = "7d" | "30d";

export function parseRange(value: string | undefined): Range {
  return value === "7d" ? "7d" : "30d";
}

/** Calls that happened (or, if the call time is unknown, were added) within the range. */
export function inRange(calls: CallSummary[], range: Range, now = Date.now()): CallSummary[] {
  const days = range === "7d" ? 7 : 30;
  const from = now - days * 86_400_000;
  return calls.filter((c) => Date.parse(c.callAt ?? c.createdAt) >= from);
}

// ---------------------------------------------------------------------------
// Overview → "Sales Leaks": where money or customers are slipping, worst first
// ---------------------------------------------------------------------------

export interface Leak {
  title: string;
  detail: string;
  count: number;
  href: string;
  action: string;
}

export function salesLeaks(i: Insights): Leak[] {
  const leaks: Leak[] = [];
  const notBooked = i.followUps.filter((f) => f.callType === "sales");
  if (notBooked.length) {
    leaks.push({
      title: `${notBooked.length} sales call${notBooked.length === 1 ? "" : "s"} didn't book`,
      detail: `${i.sales.booked} of ${i.sales.decided} sales calls booked an appointment`,
      count: notBooked.length,
      href: "/sales/calls?type=sales&open=1",
      action: "Review calls",
    });
  }
  const lost = i.followUps.filter((f) => f.callType === "retention");
  const saveable = i.retention.lostReasons
    .filter((r) => !r.unavoidable)
    .reduce((s, r) => s + r.count, 0);
  if (lost.length) {
    const top = i.retention.lostReasons.find((r) => !r.unavoidable);
    leaks.push({
      title: `${saveable || lost.length} cancellation${(saveable || lost.length) === 1 ? "" : "s"} not saved`,
      detail: top
        ? `Top reason: ${top.label.toLowerCase()}`
        : "Customers who moved away can't be saved",
      count: lost.length,
      href: "/sales/calls?type=retention&open=1",
      action: "Review calls",
    });
  }
  const unresolved = i.followUps.filter(
    (f) => f.callType === "service" || f.callType === "billing",
  );
  if (unresolved.length) {
    leaks.push({
      title: `${unresolved.length} service issue${unresolved.length === 1 ? "" : "s"} unresolved`,
      detail: "Customers waiting on a fix or a call back",
      count: unresolved.length,
      href: "/sales/calls?open=1&type=service",
      action: "Review calls",
    });
  }
  const step = i.missedSteps[0];
  if (step && step.rate >= 0.5 && step.graded >= MIN_CALLS_FOR_STEP_ISSUE) {
    leaks.push({
      title: `Reps skip “${step.label}”`,
      detail: `Missed on ${step.missed} of ${step.graded} graded calls`,
      count: step.missed,
      href: "/sales/reps",
      action: "See coaching",
    });
  }
  return leaks;
}

// ---------------------------------------------------------------------------
// Reps → "Team Overview" and "Coaching queue"
// ---------------------------------------------------------------------------

/** A rep needs coaching when their average is below Green or most of their calls are Below. */
export function needsCoaching(r: RepStats): boolean {
  if (r.graded === 0) return false;
  return (r.avgPct ?? 1) < 0.85 || r.gradeMix.below > r.gradeMix.gold + r.gradeMix.green;
}

export interface TeamOverview {
  closeRate: number | null;
  saveRate: number | null;
  avgPct: number | null;
  graded: number;
  /** Best-scoring rep who is on standard; null when nobody is. */
  topPerformer: string | null;
  needsCoaching: string[];
  /** True once some scorecard has enough graded calls (2+) to show repeated misses. */
  enoughForPatterns: boolean;
}

export function teamOverview(i: Insights, reps: RepStats[]): TeamOverview {
  const graded = i.scores.reduce((s, x) => s + x.calls, 0);
  const avgPct = graded ? i.scores.reduce((s, x) => s + x.pct * x.calls, 0) / graded : null;
  const ranked = reps.filter((r) => r.graded > 0);
  return {
    closeRate: i.sales.closeRate,
    saveRate: i.retention.saveRate,
    avgPct,
    graded,
    topPerformer: ranked.find((r) => !needsCoaching(r))?.name ?? null,
    needsCoaching: ranked.filter(needsCoaching).map((r) => r.name),
    enoughForPatterns: i.scores.some((s) => s.calls >= 2),
  };
}

/**
 * High-leverage coaching items: steps missed on at least half of their graded calls,
 * worst first, at most `perScorecard` from each scorecard so one call type (usually
 * Sales, the longest scorecard) can't crowd out the others.
 */
export function coachingQueue(i: Insights, perScorecard = 2, limit = 6): MissedStep[] {
  const taken = new Map<string, number>();
  const queue: MissedStep[] = [];
  for (const s of i.missedSteps) {
    if (s.rate < 0.5 || queue.length >= limit) continue;
    const n = taken.get(s.rubricId) ?? 0;
    if (n >= perScorecard) continue;
    taken.set(s.rubricId, n + 1);
    queue.push(s);
  }
  return queue;
}
