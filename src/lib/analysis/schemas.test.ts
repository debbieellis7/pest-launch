import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import {
  ClassificationSchema,
  ScorecardSchema,
  TurnsSchema,
  normalizeClassification,
  type ClassificationWire,
} from "./schemas";

// The API rejects structured-output schemas with more than 16 union-typed
// (nullable / anyOf / type-array) parameters.
const UNION_LIMIT = 16;

function countUnions(node: unknown): number {
  if (!node || typeof node !== "object") return 0;
  const n = node as Record<string, unknown>;
  const here = Array.isArray(n.anyOf) || Array.isArray(n.oneOf) || Array.isArray(n.type) ? 1 : 0;
  return here + Object.values(n).reduce<number>((sum, v) => sum + countUnions(v), 0);
}

describe("structured output schemas stay within the API's union limit", () => {
  it.each([
    ["classification", ClassificationSchema],
    ["scorecard", ScorecardSchema],
    ["turns", TurnsSchema],
  ] as const)("%s", (_name, schema) => {
    const count = countUnions(z.toJSONSchema(schema));
    expect(count).toBeLessThanOrEqual(UNION_LIMIT);
  });
});

describe("normalizeClassification", () => {
  const outcome: ClassificationWire["outcome"] = {
    result: "booked",
    headline: "Booked",
    sale: {
      service: "Quarterly",
      initial_price: 199,
      recurring_price: 49,
      frequency: "monthly",
      appointment: null,
      reason_not_booked: null,
    },
    retention: {
      cancel_reason: "other",
      cancel_reason_detail: "",
      offers_made: [],
      offer_accepted: null,
      saved: false,
    },
    service: { request: "", resolution: null },
    next_steps: [],
  };
  const base = { call_type: "sales", outcome } as unknown as ClassificationWire;

  it("keeps only the section that matches the call type", () => {
    const sales = normalizeClassification(base);
    expect(sales.outcome.sale?.initial_price).toBe(199);
    expect(sales.outcome.retention).toBeNull();
    expect(sales.outcome.service).toBeNull();

    const billing = normalizeClassification({ ...base, call_type: "billing" });
    expect(billing.outcome.service).not.toBeNull();
    expect(billing.outcome.sale).toBeNull();

    const retention = normalizeClassification({ ...base, call_type: "retention" });
    expect(retention.outcome.retention).not.toBeNull();
    expect(retention.outcome.sale).toBeNull();

    const other = normalizeClassification({ ...base, call_type: "other" });
    expect([other.outcome.sale, other.outcome.retention, other.outcome.service]).toEqual([
      null,
      null,
      null,
    ]);
  });
});
