import { afterEach, describe, expect, it } from "vitest";
import { DuplicateCallError, escapeLike, labelFromFilename, limitReached, maxCalls } from "./calls";

describe("call limit", () => {
  const original = process.env.MAX_CALLS;
  afterEach(() => {
    if (original === undefined) delete process.env.MAX_CALLS;
    else process.env.MAX_CALLS = original;
  });

  it("defaults to 10 and reads MAX_CALLS", () => {
    delete process.env.MAX_CALLS;
    expect(maxCalls()).toBe(10);
    process.env.MAX_CALLS = "3";
    expect(maxCalls()).toBe(3);
  });

  it("ignores invalid values", () => {
    process.env.MAX_CALLS = "abc";
    expect(maxCalls()).toBe(10);
    process.env.MAX_CALLS = "0";
    expect(maxCalls()).toBe(10);
  });

  it("is reached once the count hits the max", () => {
    expect(limitReached(9, 10)).toBe(false);
    expect(limitReached(10, 10)).toBe(true);
    expect(limitReached(11, 10)).toBe(true);
  });
});

describe("labelFromFilename", () => {
  it("normalises CALL files and keeps other names", () => {
    expect(labelFromFilename("CALL 001.mp3")).toBe("CALL-001");
    expect(labelFromFilename("Front desk.m4a")).toBe("Front desk");
  });
});

describe("duplicate uploads", () => {
  it("escapes LIKE wildcards so a name only matches itself", () => {
    expect(escapeLike("CALL 016.mp3")).toBe("CALL 016.mp3");
    expect(escapeLike("call_016%.mp3")).toBe("call\\_016\\%.mp3");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("explains which call already has the file", () => {
    const err = new DuplicateCallError("id-1", "CALL-016", "CALL 016.mp3");
    expect(err.message).toBe("CALL 016.mp3 is already in the Call Log (CALL-016).");
    expect(err.existingId).toBe("id-1");
  });
});
