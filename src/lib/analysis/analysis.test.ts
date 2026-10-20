import { describe, expect, it } from "vitest";
import { labelFromFilename } from "../calls";
import { allCallsRubric, retentionRubric, salesRubric } from "../rubrics";
import type { TranscriptUtterance } from "../transcribe";
import { formatTranscript, scoringSystem } from "./prompts";
import { buildAnalysis, rubricForClassification, toScoringContext } from "./record";
import { alignTurns, mixedSpeakersNote, needsResegmenting } from "./resegment";
import type { Classification, Scorecard } from "./schemas";

const utt = (speaker: number, start: number, end: number, text: string): TranscriptUtterance => ({
  speaker,
  start,
  end,
  text,
  confidence: 0.9,
});

function classification(overrides: Partial<Classification> = {}): Classification {
  return {
    rep_speaker: 0,
    rep_name: "Sarah",
    caller_name: "Tom",
    company: "Acme Pest",
    call_type: "sales",
    call_subtype: "new quote",
    type_confidence: 0.95,
    scorable: true,
    unscorable_reason: null,
    summary: "Tom called about ants and booked a quarterly plan.",
    outcome: {
      result: "booked",
      headline: "Booked quarterly plan",
      sale: {
        service: "Quarterly",
        initial_price: 199,
        recurring_price: 49,
        frequency: "monthly",
        appointment: "Thursday morning",
        reason_not_booked: null,
      },
      retention: null,
      service: null,
      next_steps: [],
    },
    details: {
      direction: "inbound",
      customer_status: "new",
      pests: ["ants"],
      objections: [],
      sentiment: "positive",
    },
    scoring_context: {
      objections_raised: false,
      solution_no_cost: false,
      simple_transactional: false,
      first_offer_accepted: false,
      customer_saved: false,
      bypass_retention: false,
    },
    review_flags: [],
    ...overrides,
  };
}

const transcript = [
  utt(0, 0, 3, "Thanks for calling Acme Pest, this is Sarah."),
  utt(1, 3.5, 7, "Hi, I have ants in my kitchen and want a quote."),
  utt(0, 7.5, 12, "I'm so sorry about those ants, I can definitely take care of this for you."),
];

describe("labelFromFilename", () => {
  it("normalises the provided recording names", () => {
    expect(labelFromFilename("CALL 014.mp3")).toBe("CALL-014");
    expect(labelFromFilename("call_7.wav")).toBe("CALL-007");
  });
  it("falls back to the file name", () => {
    expect(labelFromFilename("Front desk 10-19.m4a")).toBe("Front desk 10-19");
  });
});

describe("formatTranscript", () => {
  it("numbers speakers before the rep is known", () => {
    expect(formatTranscript(transcript)).toContain("[0:00] Speaker 0: Thanks for calling");
  });
  it("labels REP and CUSTOMER once the rep is known, and keeps extra voices distinct", () => {
    const text = formatTranscript([...transcript, utt(2, 13, 14, "Please hold.")], 0);
    expect(text).toContain("[0:00] REP: Thanks");
    expect(text).toContain("[0:03] CUSTOMER: Hi");
    expect(text).toContain("[0:13] OTHER (speaker 2): Please hold.");
  });
});

describe("scoringSystem", () => {
  it.each([salesRubric, allCallsRubric, retentionRubric])("lists every item of %s", (rubric) => {
    const prompt = scoringSystem(rubric);
    for (const item of rubric.items) expect(prompt).toContain(`id: ${item.id} — ${item.label}`);
  });
  it("tells the model exactly when N/A is allowed", () => {
    expect(scoringSystem(salesRubric)).toContain("N/A allowed only when: No objections raised");
  });
});

describe("rubricForClassification", () => {
  it("picks the scorecard by call type", () => {
    expect(rubricForClassification(classification())?.id).toBe("sales");
    expect(rubricForClassification(classification({ call_type: "retention" }))?.id).toBe(
      "retention",
    );
    expect(rubricForClassification(classification({ call_type: "billing" }))?.id).toBe("all_calls");
  });
  it("doesn't score calls with no conversation or no identifiable rep", () => {
    expect(rubricForClassification(classification({ scorable: false }))).toBeNull();
    expect(rubricForClassification(classification({ rep_speaker: null }))).toBeNull();
  });
});

describe("toScoringContext", () => {
  it("treats any listed objection as objections raised, even if the flag disagrees", () => {
    const c = classification({
      details: {
        direction: "inbound",
        customer_status: "new",
        pests: [],
        objections: [{ type: "price", quote: "That's too much", handled: true }],
        sentiment: "neutral",
      },
    });
    expect(toScoringContext(c).objectionsRaised).toBe(true);
  });
});

describe("buildAnalysis", () => {
  const scorecard: Scorecard = {
    items: salesRubric.items.map((i) => ({
      id: i.id,
      status: "met" as const,
      evidence: i.id === "validate" ? "I'm so sorry about those ants" : null,
      reason: "ok",
    })),
    coaching: {
      headline: "Great energy.",
      strengths: [],
      fixes: [{ item_id: "validate", what: "x", why: "y", say_this: "z", at: null }],
    },
  };

  it("scores in code and verifies quotes against the transcript", () => {
    const row = buildAnalysis(classification(), salesRubric, scorecard, transcript);
    expect(row.score).toBe(17);
    expect(row.grade).toBe("gold");
    const validate = (row.items as { id: string; evidenceVerified: boolean | null }[]).find(
      (i) => i.id === "validate",
    );
    expect(validate?.evidenceVerified).toBe(true);
  });

  it("flags met items without quotes for review", () => {
    const row = buildAnalysis(classification(), salesRubric, scorecard, transcript);
    expect(row.needs_review).toBe(true);
    expect(row.review_reasons.some((r) => r.includes("marked met without a quote"))).toBe(true);
  });

  it("points coaching fixes at the quoted moment when the model gave no time", () => {
    const row = buildAnalysis(classification(), salesRubric, scorecard, transcript);
    const fixes = (row.coaching as { fixes: { at: number | null }[] }).fixes;
    expect(fixes[0].at).toBe(7.5);
  });

  it("flags low-confidence call types", () => {
    const row = buildAnalysis(classification({ type_confidence: 0.5 }), null, null, transcript);
    expect(row.review_reasons).toContain("Call type is uncertain");
  });

  it("records unscorable calls without a score", () => {
    const row = buildAnalysis(
      classification({ scorable: false, unscorable_reason: "voicemail", call_type: "other" }),
      null,
      null,
      transcript,
    );
    expect(row).toMatchObject({
      scorable: false,
      score: null,
      grade: null,
      unscorable_reason: "voicemail",
    });
  });
});

describe("resegmenting collapsed diarization", () => {
  const collapsed = [
    utt(0, 0, 4, "Thank you for calling Acme this is Sam. Hi I need a quote."),
    utt(0, 4.5, 8, "Sure, what pests are you seeing? Mostly ants."),
  ];

  it("only triggers for single-speaker mono calls", () => {
    expect(needsResegmenting("diarize", collapsed, 30)).toBe(true);
    expect(needsResegmenting("multichannel", collapsed, 30)).toBe(false);
    expect(needsResegmenting("diarize", transcript, 30)).toBe(false);
    expect(needsResegmenting("diarize", collapsed, 10)).toBe(false);
  });

  it("maps turns back onto the timeline in order", () => {
    const turns = alignTurns(collapsed, [
      { speaker: "rep", text: "Thank you for calling Acme this is Sam." },
      { speaker: "customer", text: "Hi I need a quote." },
      { speaker: "rep", text: "Sure, what pests are you seeing?" },
      { speaker: "customer", text: "Mostly ants." },
    ]);
    expect(turns.map((t) => t.speaker)).toEqual([0, 1, 0, 1]);
    expect(turns[0].start).toBe(0);
    // "Hi" is word 8 of 12 in the first utterance → about 2.7s in
    expect(turns[1].start).toBeGreaterThan(2);
    expect(turns[1].start).toBeLessThan(3.5);
    expect(turns[2].start).toBe(4.5);
    for (let i = 1; i < turns.length; i++)
      expect(turns[i].start).toBeGreaterThanOrEqual(turns[i - 1].start);
    expect(turns.at(-1)!.end).toBe(8);
  });

  it("stays monotonic when the model's word count drifts", () => {
    const turns = alignTurns(collapsed, [
      { speaker: "rep", text: "Thank you for calling Acme, this is Sam." },
      { speaker: "customer", text: "Hi, I need a quote please, thanks." },
      { speaker: "rep", text: "What pests?" },
    ]);
    for (let i = 1; i < turns.length; i++)
      expect(turns[i].start).toBeGreaterThanOrEqual(turns[i - 1].start);
  });
});

describe("mixedSpeakersNote", () => {
  const calls = [utt(0, 0, 4, "Thanks for calling Acme."), utt(1, 5, 8, "Hi, quick question.")];
  const long = [...calls, utt(0, 57, 84, "Long stretch with both voices.")];

  it("flags a long single-speaker stretch on a mono call, with its time", () => {
    expect(mixedSpeakersNote("diarize", long, false)).toBe(
      "Speaker labels may be mixed around 0:57 (the recording is mono)",
    );
  });

  it("ignores stereo calls, AI-split calls and normal turn lengths", () => {
    expect(mixedSpeakersNote("multichannel", long, false)).toBeNull();
    expect(mixedSpeakersNote("diarize", long, true)).toBeNull();
    expect(mixedSpeakersNote("diarize", calls, false)).toBeNull();
  });
});
