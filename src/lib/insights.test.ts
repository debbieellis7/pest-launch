import { describe, expect, it } from "vitest";
import type { CallType, Grade } from "./format";
import {
  biggestIssue,
  buildInsights,
  coachingQueue,
  followUps,
  inRange,
  missedSteps,
  parseRange,
  repStats,
  salesLeaks,
  teamOverview,
} from "./insights";
import type { CallSummary } from "./queries";
import { allCallsRubric, retentionRubric, salesRubric, type Rubric } from "./rubrics";
import type { ScoredItem } from "./rubrics/types";

let n = 0;

/** A completed call; `missed` lists rubric item ids the rep didn't earn. */
function call(opts: {
  type: CallType;
  result: string;
  rep?: string;
  rubric?: Rubric | null;
  missed?: string[];
  cancelReason?: string;
  saved?: boolean;
  offerAccepted?: string | null;
  initial?: number;
  nextSteps?: string[];
}): CallSummary {
  n++;
  const rubric = opts.rubric === undefined ? defaultRubric(opts.type) : opts.rubric;
  const items: ScoredItem[] = rubric
    ? rubric.items.map((i) => {
        const earned = !(opts.missed ?? []).includes(i.id);
        return {
          id: i.id,
          label: i.label,
          quadrant: i.quadrant,
          status: earned ? "met" : "not_met",
          earned,
          evidence: null,
          evidenceStart: null,
          evidenceVerified: null,
          reason: null,
          note: null,
        };
      })
    : [];
  const score = items.filter((i) => i.earned).length;
  const grade: Grade | null = rubric
    ? score >= rubric.thresholds.gold
      ? "gold"
      : score >= rubric.thresholds.green
        ? "green"
        : "below"
    : null;
  return {
    id: `id-${n}`,
    label: `CALL-${String(n).padStart(3, "0")}`,
    status: "complete",
    failedStage: null,
    error: null,
    durationSec: 120,
    createdAt: "2026-10-20T00:00:00Z",
    callAt: null,
    stalled: false,
    analysis: {
      callType: opts.type,
      callSubtype: null,
      repName: opts.rep ?? "Sam",
      callerName: "Pat",
      scorable: Boolean(rubric),
      score: rubric ? score : null,
      maxScore: rubric?.maxScore ?? null,
      grade,
      needsReview: false,
      result: opts.result,
      headline: `${opts.type} ${opts.result}`,
      direction: "inbound",
      customerStatus: opts.type === "sales" ? "new" : "existing",
      rubricId: rubric?.id ?? null,
      items,
      outcome: {
        result: opts.result as never,
        headline: "",
        sale:
          opts.type === "sales"
            ? {
                service: "Quarterly",
                initial_price: opts.initial ?? null,
                recurring_price: null,
                frequency: null,
                appointment: null,
                reason_not_booked: null,
              }
            : null,
        retention:
          opts.type === "retention"
            ? {
                cancel_reason: (opts.cancelReason ?? "price") as never,
                cancel_reason_detail: "",
                offers_made: [],
                offer_accepted: (opts.offerAccepted ?? null) as never,
                saved: opts.saved ?? opts.result === "saved",
              }
            : null,
        service: null,
        next_steps: opts.nextSteps ?? [],
      },
    },
  };
}

function defaultRubric(type: CallType): Rubric | null {
  if (type === "sales") return salesRubric;
  if (type === "retention") return retentionRubric;
  if (type === "other") return null;
  return allCallsRubric;
}

describe("buildInsights", () => {
  const calls = [
    call({ type: "sales", result: "booked", initial: 199 }),
    call({ type: "sales", result: "not_booked", missed: ["close", "pricing"] }),
    call({ type: "sales", result: "follow_up", missed: ["close"] }),
    call({ type: "retention", result: "saved", offerAccepted: "free_reservice" }),
    call({ type: "retention", result: "cancelled", cancelReason: "price" }),
    call({ type: "retention", result: "cancelled", cancelReason: "moving" }),
    call({ type: "retention", result: "cancelled", cancelReason: "price" }),
    call({ type: "service", result: "resolved" }),
    call({ type: "billing", result: "unresolved", missed: ["thank"] }),
    call({ type: "other", result: "no_outcome" }),
  ];
  const i = buildInsights(calls);

  it("computes close rate over sales calls that reached a decision", () => {
    expect(i.sales).toMatchObject({ calls: 3, decided: 3, booked: 1, bookedInitial: 199 });
    expect(i.sales.closeRate).toBeCloseTo(1 / 3);
  });

  it("computes save rate and ranks why customers left", () => {
    // the customer who moved away can't be saved, so 1 of 3 saveable
    expect(i.retention).toMatchObject({ calls: 4, saved: 1, decided: 3 });
    expect(i.retention.saveRate).toBeCloseTo(1 / 3);
    expect(i.retention.lostReasons[0]).toEqual({
      reason: "price",
      label: "Price",
      count: 2,
      unavoidable: false,
    });
    expect(i.retention.winningOffers[0]).toMatchObject({ offer: "free_reservice", count: 1 });
  });

  it("doesn't count customers who moved away against the save rate", () => {
    const moved = buildInsights([
      call({ type: "retention", result: "saved" }),
      call({ type: "retention", result: "cancelled", cancelReason: "moving" }),
    ]);
    expect(moved.retention).toMatchObject({ saved: 1, decided: 1, saveRate: 1 });
    expect(moved.retention.lostReasons).toEqual([
      { reason: "moving", label: "Moving", count: 1, unavoidable: true },
    ]);
  });

  it("needs 3+ graded calls before a missed step can be the biggest issue", () => {
    const two = buildInsights([
      call({ type: "service", result: "resolved", missed: ["summary"] }),
      call({ type: "service", result: "resolved", missed: ["summary"] }),
    ]);
    expect(two.biggestIssue?.title).not.toContain("Summary");
    const three = buildInsights([
      call({ type: "service", result: "resolved", missed: ["summary"] }),
      call({ type: "service", result: "resolved", missed: ["summary"] }),
      call({ type: "service", result: "resolved", missed: ["summary"] }),
    ]);
    expect(three.biggestIssue?.title).toContain("Summary Statement");
  });

  it("treats service and billing as customer service", () => {
    expect(i.service).toMatchObject({ calls: 2, resolved: 1, decided: 2, resolveRate: 0.5 });
  });

  it("averages scores per scorecard and counts the grade mix", () => {
    const sales = i.scores.find((s) => s.rubricId === "sales")!;
    expect(sales.calls).toBe(3);
    expect(sales.avg).toBeCloseTo((17 + 15 + 16) / 3);
    expect(i.gradeMix.gold + i.gradeMix.green + i.gradeMix.below).toBe(i.totals.graded);
    expect(i.totals).toMatchObject({ calls: 10, analyzed: 10, graded: 9 });
  });

  it("puts the worst problem in the biggest-issue card", () => {
    // lost customers outrank the coaching gaps in this set
    expect(i.biggestIssue).toMatchObject({
      title: "Cancellations aren't being saved",
      metric: "1 of 3 saved",
    });
    expect(i.biggestIssue?.detail).toContain("price");
  });

  it("counts calls from new customers as new leads", () => {
    const leads = buildInsights([
      call({ type: "sales", result: "booked" }),
      call({ type: "sales", result: "not_booked" }),
      call({ type: "service", result: "resolved" }),
    ]);
    expect(leads.totals.newLeads).toBe(2);
  });

  it("ignores calls that are still processing or failed", () => {
    const pending = { ...call({ type: "sales", result: "booked" }), status: "analyzing" as const };
    expect(buildInsights([pending]).sales.calls).toBe(0);
  });
});

describe("missedSteps", () => {
  it("ranks steps by how often they're missed and keeps example calls", () => {
    const calls = [
      call({ type: "sales", result: "booked", missed: ["close"] }),
      call({ type: "sales", result: "booked", missed: ["close", "pricing"] }),
      call({ type: "sales", result: "booked" }),
    ];
    const steps = missedSteps(buildInsightsInput(calls));
    expect(steps[0]).toMatchObject({ itemId: "close", missed: 2, graded: 3 });
    expect(steps[0].examples.map((e) => e.label)).toEqual([calls[0].label, calls[1].label]);
    expect(steps[1]).toMatchObject({ itemId: "pricing", missed: 1 });
  });

  it("doesn't count N/A items as missed or graded", () => {
    const c = call({ type: "sales", result: "booked" });
    c.analysis!.items = c.analysis!.items.map((it) =>
      it.id === "agree" ? { ...it, status: "na", earned: true } : it,
    );
    const steps = missedSteps(buildInsightsInput([c, c]));
    expect(steps.find((s) => s.itemId === "agree")).toBeUndefined();
  });
});

describe("followUps", () => {
  it("lists winnable and lost calls, most urgent first", () => {
    const list = followUps(
      buildInsightsInput([
        call({ type: "retention", result: "cancelled" }),
        call({ type: "sales", result: "booked" }),
        call({ type: "service", result: "unresolved" }),
        call({ type: "sales", result: "follow_up", nextSteps: ["Call back Friday"] }),
      ]),
    );
    expect(list.map((f) => f.result)).toEqual(["follow_up", "unresolved", "cancelled"]);
    expect(list[0].nextSteps).toEqual(["Call back Friday"]);
  });
});

describe("biggestIssue", () => {
  it("says so when the team is on standard", () => {
    const i = buildInsights([
      call({ type: "sales", result: "booked" }),
      call({ type: "retention", result: "saved" }),
    ]);
    expect(biggestIssue(i)).toMatchObject({
      tone: "good",
      title: "Your team is on standard",
      metric: "2 of 2 calls on standard",
    });
  });

  it("returns nothing before any call is graded", () => {
    expect(buildInsights([]).biggestIssue).toBeNull();
  });

  it("needs 2+ cancel calls before the save rate can be the biggest issue", () => {
    const skipped = Array.from({ length: 3 }, () =>
      call({ type: "service", result: "resolved", missed: ["summary"] }),
    );
    const one = buildInsights([call({ type: "retention", result: "cancelled" }), ...skipped]);
    expect(one.biggestIssue?.title).toContain("Summary Statement");
    expect(one.biggestIssue?.detail).toContain("All Calls scorecard");

    const two = buildInsights([
      call({ type: "retention", result: "cancelled" }),
      call({ type: "retention", result: "cancelled" }),
      ...skipped,
    ]);
    expect(two.biggestIssue).toMatchObject({
      title: "Cancellations aren't being saved",
      metric: "0 of 2 saved",
    });
  });

  it("doesn't call the team on standard when most calls are Below but too few to flag", () => {
    const i = buildInsights([
      call({ type: "service", result: "resolved", missed: ["validate", "thank"] }),
      call({ type: "service", result: "resolved", missed: ["validate", "thank"] }),
    ]);
    expect(i.gradeMix.below).toBe(2);
    expect(i.biggestIssue).toBeNull();
  });
});

describe("repStats", () => {
  it("summarises each rep, best average first", () => {
    const reps = repStats([
      call({ type: "sales", result: "booked", rep: "Ana" }),
      call({
        type: "sales",
        result: "not_booked",
        rep: "Ben",
        missed: ["close", "pricing", "summary"],
      }),
      call({ type: "sales", result: "booked", rep: "Ben", missed: ["close"] }),
    ]);
    expect(reps.map((r) => r.name)).toEqual(["Ana", "Ben"]);
    expect(reps[1]).toMatchObject({ calls: 2, graded: 2, closeRate: 0.5, followUps: 1 });
    expect(reps[0].followUps).toBe(0);
    expect(reps[1].topMissed[0]).toMatchObject({ itemId: "close", missed: 2 });
    expect(reps[0].avgPct).toBe(1);
  });

  it("picks each rep's highest-scoring graded call as their best call", () => {
    const weak = call({
      type: "sales",
      result: "not_booked",
      rep: "Ben",
      missed: ["close", "pricing"],
    });
    const strong = call({ type: "sales", result: "booked", rep: "Ben", missed: ["close"] });
    const ungraded = call({ type: "other", result: "other", rep: "Ben", rubric: null });
    const [ben] = repStats([weak, strong, ungraded]);
    expect(ben.bestCallId).toBe(strong.id);
    expect(ben.topMissed.map((s) => s.itemId)).toEqual(["close", "pricing"]);
  });
});

// missedSteps/followUps take already-filtered completed calls.
function buildInsightsInput(calls: CallSummary[]) {
  return calls as (CallSummary & { analysis: NonNullable<CallSummary["analysis"]> })[];
}

describe("date range", () => {
  it("defaults to 30 days and keeps calls inside the window", () => {
    expect(parseRange(undefined)).toBe("30d");
    expect(parseRange("7d")).toBe("7d");
    const now = Date.parse("2026-10-20T00:00:00Z");
    const recent = {
      ...call({ type: "sales", result: "booked" }),
      createdAt: "2026-10-18T00:00:00Z",
    };
    const older = {
      ...call({ type: "sales", result: "booked" }),
      createdAt: "2026-10-01T00:00:00Z",
    };
    const dated = {
      ...call({ type: "sales", result: "booked" }),
      createdAt: "2026-10-19T00:00:00Z",
      callAt: "2026-09-01T00:00:00Z",
    };
    expect(inRange([recent, older, dated], "7d", now)).toEqual([recent]);
    expect(inRange([recent, older, dated], "30d", now)).toEqual([recent, older]);
  });
});

describe("salesLeaks", () => {
  it("lists each kind of leak with a link to the calls behind it", () => {
    const i = buildInsights([
      call({ type: "sales", result: "not_booked" }),
      call({ type: "sales", result: "booked" }),
      call({ type: "retention", result: "cancelled", cancelReason: "price" }),
      call({ type: "billing", result: "unresolved" }),
    ]);
    const leaks = salesLeaks(i);
    expect(leaks.map((l) => l.title)).toEqual([
      "1 sales call didn't book",
      "1 cancellation not saved",
      "1 service issue unresolved",
    ]);
    expect(leaks[0]).toMatchObject({
      detail: "1 of 2 sales calls booked an appointment",
      href: "/sales/calls?type=sales&open=1",
    });
    expect(leaks[1].detail).toBe("Top reason: price");
  });

  it("is empty when nothing is slipping", () => {
    expect(salesLeaks(buildInsights([call({ type: "sales", result: "booked" })]))).toEqual([]);
  });
});

describe("teamOverview and coachingQueue", () => {
  const calls = [
    call({ type: "sales", result: "booked", rep: "Ana" }),
    call({
      type: "sales",
      result: "not_booked",
      rep: "Ben",
      missed: ["close", "pricing", "summary", "consensus"],
    }),
    call({
      type: "sales",
      result: "booked",
      rep: "Ben",
      missed: ["close", "summary", "pricing", "re_close"],
    }),
  ];
  const i = buildInsights(calls);
  const reps = repStats(calls);

  it("names the top performer and who needs coaching", () => {
    const t = teamOverview(i, reps);
    expect(t).toMatchObject({ topPerformer: "Ana", needsCoaching: ["Ben"], graded: 3 });
    expect(t.closeRate).toBeCloseTo(2 / 3);
  });

  it("names no top performer when every rep needs coaching, and waits for 2+ calls per scorecard", () => {
    const thin = [
      call({
        type: "sales",
        result: "booked",
        rep: "Ana",
        missed: ["close", "pricing", "summary", "consensus"],
      }),
      call({
        type: "retention",
        result: "cancelled",
        rep: "Ben",
        missed: ["repeat", "teaser", "consensus"],
      }),
    ];
    const t = teamOverview(buildInsights(thin), repStats(thin));
    expect(t.topPerformer).toBeNull();
    expect(t.needsCoaching).toEqual(expect.arrayContaining(["Ana", "Ben"]));
    expect(t.enoughForPatterns).toBe(false);
    expect(teamOverview(i, reps).enoughForPatterns).toBe(true);
  });

  it("queues the worst steps missed on at least half their calls, 2 per scorecard", () => {
    const q = coachingQueue(i);
    expect(q).toHaveLength(2);
    expect(q.every((s) => s.rubricId === "sales" && s.rate >= 0.5)).toBe(true);
    expect(["close", "summary", "pricing"]).toEqual(expect.arrayContaining(q.map((s) => s.itemId)));
  });

  it("doesn't let one scorecard crowd out the others", () => {
    const salesMisses = ["close", "pricing", "summary", "consensus"];
    const mixed = buildInsights([
      ...Array.from({ length: 3 }, () =>
        call({ type: "sales", result: "booked", missed: salesMisses }),
      ),
      ...Array.from({ length: 2 }, () =>
        call({ type: "service", result: "resolved", missed: ["validate", "thank"] }),
      ),
    ]);
    const q = coachingQueue(mixed);
    const by = (id: string) => q.filter((s) => s.rubricId === id).length;
    expect(by("sales")).toBe(2);
    expect(by("all_calls")).toBe(2);
    expect(q.find((s) => s.rubricId === "all_calls")).toMatchObject({ missed: 2, graded: 2 });
  });
});
