import { describe, expect, it } from "vitest";
import {
  STALE_AFTER_MS,
  formatDuration,
  friendlyError,
  initials,
  isStalled,
  gradeSummary,
  score100,
  scoreTone,
} from "./format";

describe("score100", () => {
  it("shows a 0–1 score as the percentage of steps hit", () => {
    expect(score100(0.864)).toBe("86%");
    expect(score100(1)).toBe("100%");
    expect(score100(0)).toBe("0%");
    expect(score100(null)).toBe("-");
  });
  it("shows a dash when there's no score", () => {
    expect(score100(null)).toBe("-");
    expect(score100(undefined)).toBe("-");
  });
});

describe("scoreTone", () => {
  it("is green at Gold-ish scores, amber in the middle, red below", () => {
    expect(scoreTone(0.95)).toBe("text-green");
    expect(scoreTone(0.8)).toBe("text-gold");
    expect(scoreTone(0.5)).toBe("text-red");
    expect(scoreTone(null)).toBe("text-faint");
  });
});

describe("initials", () => {
  it("uses up to two initials", () => {
    expect(initials("Michelle Sheneman")).toBe("MS");
    expect(initials("Sam")).toBe("S");
    expect(initials("Mary Ann Brown")).toBe("MA");
  });
});

describe("formatDuration", () => {
  it("formats seconds as m:ss or h:mm:ss", () => {
    expect(formatDuration(75.4)).toBe("1:15");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(null)).toBe("—");
  });
});

describe("isStalled", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("flags a call that has been processing with no progress for over 10 minutes", () => {
    for (const status of ["uploaded", "transcribing", "analyzing"]) {
      expect(isStalled(status, ago(STALE_AFTER_MS + 1000), now)).toBe(true);
    }
  });

  it("leaves recent runs alone", () => {
    expect(isStalled("analyzing", ago(STALE_AFTER_MS - 1000), now)).toBe(false);
  });

  it("never flags finished or failed calls", () => {
    expect(isStalled("complete", ago(STALE_AFTER_MS * 6), now)).toBe(false);
    expect(isStalled("failed", ago(STALE_AFTER_MS * 6), now)).toBe(false);
  });
});

describe("friendlyError", () => {
  it("explains a failure by stage instead of showing the raw error", () => {
    const raw = "Could not sign recording URL: Object not found";
    expect(friendlyError(raw, "upload")).toBe("The recording file is missing. Upload it again.");
    expect(friendlyError("Deepgram failed: 400", "transcribe")).toMatch(/couldn't transcribe/);
    expect(friendlyError("Saving analysis failed", "analyze")).toBe(
      "The analysis didn't finish. Retry.",
    );
    expect(friendlyError(raw, null)).not.toContain("Object not found");
  });

  it("keeps the specific API-key and timeout messages", () => {
    expect(friendlyError("401 authentication_error", "analyze")).toMatch(/API key/);
    expect(friendlyError("Request timed out", "transcribe")).toBe(
      "Processing took too long. Try again.",
    );
  });
});

describe("gradeSummary", () => {
  it("names grades in plain words and leaves out zeros", () => {
    expect(gradeSummary({ gold: 0, green: 1, below: 3 })).toBe("1 on standard · 3 below standard");
    expect(gradeSummary({ gold: 2, green: 0, below: 0 })).toBe("2 perfect (Gold)");
    expect(gradeSummary({ gold: 0, green: 0, below: 0 })).toBe("No graded calls");
  });
});
