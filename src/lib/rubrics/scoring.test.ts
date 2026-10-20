import { describe, expect, it } from "vitest";
import {
  RUBRICS,
  allCallsRubric,
  gradeFor,
  retentionRubric,
  rubricFor,
  salesRubric,
  scoreCall,
  type RawItemResult,
  type Rubric,
} from "./index";

/** Every item met, with a quote. */
function allMet(rubric: Rubric): RawItemResult[] {
  return rubric.items.map((i) => ({ id: i.id, status: "met", evidence: `quote for ${i.id}` }));
}

/** Every item met except the given ids, which are not_met. */
function missing(rubric: Rubric, ...ids: string[]): RawItemResult[] {
  return allMet(rubric).map((r) => (ids.includes(r.id) ? { ...r, status: "not_met" as const } : r));
}

const item = (res: ReturnType<typeof scoreCall>, id: string) => res.items.find((i) => i.id === id)!;

describe("rubric definitions match the manuals", () => {
  it.each([
    [salesRubric, 17],
    [allCallsRubric, 12],
    [retentionRubric, 12],
  ])("%s has one item per point", (rubric, max) => {
    expect(rubric.maxScore).toBe(max);
    expect(rubric.items).toHaveLength(max);
    expect(new Set(rubric.items.map((i) => i.id)).size).toBe(max);
  });

  it("every item has a definition and at least one manual example", () => {
    for (const rubric of Object.values(RUBRICS)) {
      for (const i of rubric.items) {
        expect(i.definition.length).toBeGreaterThan(10);
        expect(i.examples.length).toBeGreaterThan(0);
      }
    }
  });

  it("covers all 4 quadrants in each rubric", () => {
    for (const rubric of Object.values(RUBRICS)) {
      expect(new Set(rubric.items.map((i) => i.quadrant))).toEqual(
        new Set(["validation", "understand", "solve", "verify"]),
      );
    }
  });
});

describe("rubricFor", () => {
  it("maps call types to the right scorecard", () => {
    expect(rubricFor("sales", true)).toBe(salesRubric);
    expect(rubricFor("retention", true)).toBe(retentionRubric);
    expect(rubricFor("service", true)).toBe(allCallsRubric);
    expect(rubricFor("billing", true)).toBe(allCallsRubric);
    expect(rubricFor("other", true)).toBe(allCallsRubric);
  });
  it("returns null for unscorable calls", () => {
    expect(rubricFor("sales", false)).toBeNull();
  });
});

describe("grade thresholds", () => {
  it("Sales: 17 Gold, 14–16 Green, ≤13 Below", () => {
    expect(gradeFor(salesRubric, 17)).toBe("gold");
    expect(gradeFor(salesRubric, 16)).toBe("green");
    expect(gradeFor(salesRubric, 14)).toBe("green");
    expect(gradeFor(salesRubric, 13)).toBe("below");
    expect(gradeFor(salesRubric, 0)).toBe("below");
  });
  it.each([allCallsRubric, retentionRubric])("$name: 12 Gold, 11 Green, ≤10 Below", (rubric) => {
    expect(gradeFor(rubric, 12)).toBe("gold");
    expect(gradeFor(rubric, 11)).toBe("green");
    expect(gradeFor(rubric, 10)).toBe("below");
  });
});

describe("scoreCall — basics", () => {
  it("perfect sales call is 17/17 Gold with no review flags", () => {
    const res = scoreCall(salesRubric, allMet(salesRubric), { objectionsRaised: true });
    expect(res.score).toBe(17);
    expect(res.grade).toBe("gold");
    expect(res.reviewReasons).toEqual([]);
  });

  it("score is computed from items, so 3 misses on a sales call is 14 = Green", () => {
    const res = scoreCall(salesRubric, missing(salesRubric, "summary", "pricing", "final_info"), {
      objectionsRaised: true,
    });
    expect(res.score).toBe(14);
    expect(res.grade).toBe("green");
  });

  it("an item missing from the model output counts as missed and is flagged", () => {
    const raw = allMet(allCallsRubric).filter((r) => r.id !== "thank");
    const res = scoreCall(allCallsRubric, raw);
    expect(item(res, "thank").status).toBe("not_met");
    expect(res.score).toBe(11);
    expect(res.reviewReasons.some((r) => r.includes("Thank the Customer"))).toBe(true);
  });

  it("ignores unknown item ids from the model", () => {
    const raw = [...allMet(allCallsRubric), { id: "made_up", status: "met" as const }];
    const res = scoreCall(allCallsRubric, raw);
    expect(res.items).toHaveLength(12);
    expect(res.score).toBe(12);
  });

  it("keeps rubric order regardless of model order", () => {
    const res = scoreCall(allCallsRubric, allMet(allCallsRubric).reverse());
    expect(res.items.map((i) => i.id)).toEqual(allCallsRubric.items.map((i) => i.id));
  });
});

describe("Sales — automatic objection points", () => {
  const objectionIds = ["agree", "restate_insinuate", "resolve", "re_close"];

  it("no objections: all 4 objection points awarded even if the model says not_met", () => {
    const res = scoreCall(salesRubric, missing(salesRubric, ...objectionIds), {
      objectionsRaised: false,
    });
    for (const id of objectionIds) {
      expect(item(res, id).status).toBe("na");
      expect(item(res, id).earned).toBe(true);
      expect(item(res, id).note).toMatch(/No objections/);
    }
    expect(res.score).toBe(17);
  });

  it("objections raised but not handled: points are lost", () => {
    const res = scoreCall(salesRubric, missing(salesRubric, ...objectionIds), {
      objectionsRaised: true,
    });
    expect(res.score).toBe(13);
    expect(res.grade).toBe("below");
  });

  it("objections raised: N/A on an objection item is rejected", () => {
    const raw = allMet(salesRubric).map((r) =>
      r.id === "agree" ? { ...r, status: "na" as const } : r,
    );
    const res = scoreCall(salesRubric, raw, { objectionsRaised: true });
    expect(item(res, "agree").status).toBe("not_met");
    expect(res.reviewReasons.some((r) => r.includes("Agree"))).toBe(true);
  });
});

describe("All Calls — special rules", () => {
  it("no-cost solution: close mirrors consensus", () => {
    const res = scoreCall(allCallsRubric, missing(allCallsRubric, "close"), {
      solutionNoCost: true,
    });
    expect(item(res, "close").status).toBe("met");
    expect(item(res, "close").note).toMatch(/consensus counts as the close/);
    expect(res.score).toBe(12);
  });

  it("no-cost solution: missing consensus also loses the close", () => {
    const res = scoreCall(allCallsRubric, missing(allCallsRubric, "consensus"), {
      solutionNoCost: true,
    });
    expect(item(res, "close").status).toBe("not_met");
    expect(res.score).toBe(10);
  });

  it("paid solution: close is scored on its own", () => {
    const res = scoreCall(allCallsRubric, missing(allCallsRubric, "close"), {
      solutionNoCost: false,
    });
    expect(item(res, "close").status).toBe("not_met");
    expect(res.score).toBe(11);
  });

  it("simple scheduling call: N/A on Understand items is honoured", () => {
    const raw = allMet(allCallsRubric).map((r) =>
      ["investigate", "summary", "expectation_2"].includes(r.id)
        ? { ...r, status: "na" as const }
        : r,
    );
    const res = scoreCall(allCallsRubric, raw, { simpleTransactional: true });
    expect(res.score).toBe(12);
    expect(item(res, "investigate").note).toMatch(/less applicable/);
  });

  it("simple scheduling call: Understand items are NOT auto-awarded when the model says not_met", () => {
    const res = scoreCall(allCallsRubric, missing(allCallsRubric, "investigate"), {
      simpleTransactional: true,
    });
    expect(item(res, "investigate").status).toBe("not_met");
    expect(res.score).toBe(11);
  });

  it("non-simple call: N/A on Understand items is rejected", () => {
    const raw = allMet(allCallsRubric).map((r) =>
      r.id === "investigate" ? { ...r, status: "na" as const } : r,
    );
    const res = scoreCall(allCallsRubric, raw, { simpleTransactional: false });
    expect(item(res, "investigate").status).toBe("not_met");
    expect(res.score).toBe(11);
  });
});

describe("Retention — special rules", () => {
  it("first offer accepted + saved: repeat and teaser awarded", () => {
    const res = scoreCall(retentionRubric, missing(retentionRubric, "repeat", "teaser"), {
      firstOfferAccepted: true,
      customerSaved: true,
    });
    expect(item(res, "repeat").earned).toBe(true);
    expect(item(res, "teaser").earned).toBe(true);
    expect(res.score).toBe(12);
  });

  it("cancelled after one declined offer with no repeat and no teaser: both missed", () => {
    const res = scoreCall(retentionRubric, missing(retentionRubric, "repeat", "teaser"), {
      firstOfferAccepted: false,
      customerSaved: false,
    });
    expect(res.score).toBe(10);
    expect(res.grade).toBe("below");
  });

  it("moving out of area: save steps can be bypassed", () => {
    const res = scoreCall(
      retentionRubric,
      missing(retentionRubric, "present_solution", "consensus", "repeat", "teaser"),
      { bypassRetention: true, customerSaved: false },
    );
    expect(item(res, "present_solution").earned).toBe(true);
    expect(item(res, "consensus").earned).toBe(true);
    expect(item(res, "repeat").earned).toBe(true);
    expect(item(res, "teaser").earned).toBe(false); // teaser still expected on a cancel
    expect(res.score).toBe(11);
  });
});

describe("evidence verification hook", () => {
  it("flags met items whose quote isn't found, but keeps the point", () => {
    const res = scoreCall(allCallsRubric, allMet(allCallsRubric), {}, (q) => ({
      verified: !q.includes("thank"),
      start: 5,
    }));
    expect(item(res, "thank").evidenceVerified).toBe(false);
    expect(item(res, "thank").earned).toBe(true);
    expect(item(res, "validate").evidenceVerified).toBe(true);
    expect(item(res, "validate").evidenceStart).toBe(5);
    expect(res.reviewReasons).toEqual([
      'Quote for "Thank the Customer" wasn\'t found in the transcript',
    ]);
  });

  it("flags met items with no quote at all", () => {
    const raw = allMet(allCallsRubric).map((r) =>
      r.id === "validate" ? { ...r, evidence: null } : r,
    );
    const res = scoreCall(allCallsRubric, raw);
    expect(res.reviewReasons).toEqual(['"Validate" marked met without a quote']);
  });
});
