import { describe, expect, it } from "vitest";
import { normalizeTokens, verifyQuote, type Utterance } from "./evidence";

// Synthetic transcript — not from the real recordings.
const transcript: Utterance[] = [
  {
    speaker: 0,
    start: 0.5,
    end: 4.0,
    text: "Good morning! Acme Pest, this is Jordan speaking, how can I help you today?",
  },
  {
    speaker: 1,
    start: 4.2,
    end: 9.8,
    text: "Hi, yeah, we've got ants all over the kitchen counter again.",
  },
  {
    speaker: 0,
    start: 10.0,
    end: 16.5,
    text: "Oh no, I'm so sorry to hear that. If that was my kitchen I'd be going crazy.",
  },
  { speaker: 0, start: 16.6, end: 21.0, text: "I can definitely take care of this for you." },
  { speaker: 1, start: 21.2, end: 23.0, text: "Great, thank you." },
  {
    speaker: 0,
    start: 23.5,
    end: 30.0,
    text: "When did you first start noticing them? And where are they coming in?",
  },
];

describe("normalizeTokens", () => {
  it("lowercases, drops punctuation, expands contractions", () => {
    expect(normalizeTokens("I'm SO sorry — that's $199!")).toEqual([
      "i",
      "am",
      "so",
      "sorry",
      "that",
      "is",
      "$199",
    ]);
    expect(normalizeTokens("We can’t, I'd, we've, don't")).toEqual([
      "we",
      "can",
      "not",
      "i",
      "would",
      "we",
      "have",
      "do",
      "not",
    ]);
  });

  it("keeps possessives as a single token", () => {
    expect(normalizeTokens("Jordan's truck")).toEqual(["jordans", "truck"]);
  });
});

describe("verifyQuote", () => {
  it("finds an exact quote and returns its utterance start time", () => {
    const m = verifyQuote("I can definitely take care of this for you.", transcript);
    expect(m.verified).toBe(true);
    expect(m.start).toBe(16.6);
    expect(m.utteranceIndex).toBe(3);
    expect(m.score).toBe(1);
  });

  it("tolerates small differences between the model's quote and the transcript", () => {
    const m = verifyQuote(
      "I am so sorry to hear that, if that was my kitchen I would be going crazy",
      transcript,
    );
    expect(m.verified).toBe(true);
    expect(m.start).toBe(10.0);
  });

  it("matches quotes that span two consecutive turns", () => {
    const m = verifyQuote("I'd be going crazy. I can definitely take care of this", transcript);
    expect(m.verified).toBe(true);
    expect(m.start).toBe(10.0);
  });

  it("rejects a fabricated quote", () => {
    const m = verifyQuote(
      "We also have an amazing referral program, your next month is free",
      transcript,
    );
    expect(m.verified).toBe(false);
  });

  it("rejects a quote that only shares a few common words", () => {
    const m = verifyQuote("Thank you so much for calling, have a great day", transcript);
    expect(m.verified).toBe(false);
  });

  it("handles empty input", () => {
    expect(verifyQuote("", transcript).verified).toBe(false);
    expect(verifyQuote("hello", []).verified).toBe(false);
  });
});
