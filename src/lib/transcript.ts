import type { Utterance } from "./evidence";

/**
 * Speech-to-text cuts a new utterance at every short pause, so one sentence can arrive
 * as three lines. For reading, join consecutive lines from the same speaker when the
 * pause between them is short. Display only: stored utterances (and quote matching)
 * are unchanged, and each block keeps the start time of its first line.
 */
export function mergeForDisplay<T extends Utterance>(utterances: T[], maxGapSec = 2): T[] {
  const out: T[] = [];
  for (const u of utterances) {
    const last = out.at(-1);
    if (last && last.speaker === u.speaker && u.start - last.end <= maxGapSec) {
      out[out.length - 1] = {
        ...last,
        end: Math.max(last.end, u.end),
        text: `${last.text} ${u.text}`,
      };
    } else {
      out.push({ ...u });
    }
  }
  return out;
}
