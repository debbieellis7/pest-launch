import { describe, expect, it } from "vitest";
import type { SyncPrerecordedResponse } from "@deepgram/sdk";
import { linesFromWords, toTranscript } from "./transcribe";

const w = (word: string, start: number, end: number, speaker: number) => ({
  word: word.toLowerCase(),
  punctuated_word: word,
  start,
  end,
  confidence: 0.9,
  speaker,
});

describe("linesFromWords", () => {
  it("starts a new line whenever the speaker changes, even mid-block", () => {
    const lines = linesFromWords([
      w("The", 56, 56.2, 0),
      w("30th.", 56.3, 56.8, 0),
      w("No.", 57, 57.3, 1),
      w("That's", 57.4, 57.6, 1),
      w("fine.", 57.7, 58, 1),
      w("Okay.", 58.1, 58.4, 0),
    ]);
    expect(lines.map((l) => [l.speaker, l.start, l.text])).toEqual([
      [0, 56, "The 30th."],
      [1, 57, "No. That's fine."],
      [0, 58.1, "Okay."],
    ]);
  });

  it("starts a new line after a pause from the same speaker", () => {
    const lines = linesFromWords([
      w("Hold", 1, 1.3, 0),
      w("on.", 1.4, 1.6, 0),
      w("Okay.", 4, 4.3, 0),
    ]);
    expect(lines.map((l) => l.text)).toEqual(["Hold on.", "Okay."]);
  });
});

describe("toTranscript", () => {
  const response = (channels: number) =>
    ({
      metadata: { channels, duration: 10, model_info: {}, request_id: "r" },
      results: {
        channels: [{ alternatives: [{ words: [w("Hi.", 0, 0.5, 0), w("Hello.", 0.6, 1, 1)] }] }],
        utterances: [
          { channel: 0, speaker: 0, start: 0, end: 1, transcript: "Hi. Hello.", confidence: 0.9 },
        ],
      },
    }) as unknown as SyncPrerecordedResponse;

  it("builds mono lines from word speaker labels", () => {
    const t = toTranscript(response(1));
    expect(t.mode).toBe("diarize");
    expect(t.utterances.map((u) => [u.speaker, u.text])).toEqual([
      [0, "Hi."],
      [1, "Hello."],
    ]);
  });

  it("keeps channel-based utterances for stereo", () => {
    const t = toTranscript(response(2));
    expect(t.mode).toBe("multichannel");
    expect(t.utterances.map((u) => [u.speaker, u.text])).toEqual([[0, "Hi. Hello."]]);
  });
});
