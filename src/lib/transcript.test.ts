import { describe, expect, it } from "vitest";
import { mergeForDisplay } from "./transcript";

const u = (speaker: number, start: number, end: number, text: string) => ({
  speaker,
  start,
  end,
  text,
});

describe("mergeForDisplay", () => {
  it("joins same-speaker fragments separated by short pauses", () => {
    const merged = mergeForDisplay([
      u(1, 5, 6, "I've seen a few"),
      u(1, 6.4, 9, "ants near the back door,"),
      u(1, 9.3, 10, "mostly at night."),
      u(0, 10.5, 12, "Got it."),
    ]);
    expect(merged).toEqual([
      u(1, 5, 10, "I've seen a few ants near the back door, mostly at night."),
      u(0, 10.5, 12, "Got it."),
    ]);
  });

  it("keeps lines apart after a long pause or a speaker change", () => {
    const merged = mergeForDisplay([
      u(0, 0, 2, "Let me check."),
      u(0, 10, 11, "Okay, found it."),
      u(1, 11.2, 12, "Great."),
      u(0, 12.1, 13, "So,"),
    ]);
    expect(merged.map((m) => m.text)).toEqual([
      "Let me check.",
      "Okay, found it.",
      "Great.",
      "So,",
    ]);
  });

  it("does not mutate the input", () => {
    const input = [u(0, 0, 1, "a"), u(0, 1.1, 2, "b")];
    mergeForDisplay(input);
    expect(input[0].text).toBe("a");
  });
});
