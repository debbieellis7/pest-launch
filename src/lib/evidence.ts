// Verifies that a quote cited by the AI actually appears in the transcript, and
// finds where. Transcription and the model both paraphrase slightly, so this is
// a tolerant in-order token match rather than an exact substring search.

export interface Utterance {
  speaker: number;
  start: number;
  end: number;
  text: string;
}

export interface QuoteMatch {
  verified: boolean;
  start: number | null;
  utteranceIndex: number | null;
  /** Fraction of quote tokens found in order within the best window (0–1). */
  score: number;
}

const MATCH_THRESHOLD = 0.8;

// Expanded on both sides so "I'm"/"I am" and "I'd"/"I would" compare equal —
// transcripts and model quotes often disagree on contractions.
const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, "can not"],
  [/\bwon't\b/g, "will not"],
  [/\b(\w+)n't\b/g, "$1 not"],
  [/\bi'm\b/g, "i am"],
  [/\b(\w+)'re\b/g, "$1 are"],
  [/\b(\w+)'ve\b/g, "$1 have"],
  [/\b(\w+)'ll\b/g, "$1 will"],
  [/\b(\w+)'d\b/g, "$1 would"],
  [/\b(it|that|there|what|he|she|who|here|let)'s\b/g, "$1 is"],
];

export function normalizeTokens(text: string): string[] {
  let s = text.toLowerCase().replace(/[’‘]/g, "'");
  for (const [pattern, replacement] of CONTRACTIONS) s = s.replace(pattern, replacement);
  return s
    .replace(/'/g, "")
    .replace(/[^a-z0-9$%]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Length of the longest common subsequence of two token arrays. */
function lcsLength(a: string[], b: string[]): number {
  const prev = new Array(b.length + 1).fill(0);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function verifyQuote(quote: string, utterances: Utterance[]): QuoteMatch {
  const q = normalizeTokens(quote);
  if (q.length === 0 || utterances.length === 0) {
    return { verified: false, start: null, utteranceIndex: null, score: 0 };
  }

  // Flatten the transcript into one token stream, remembering each token's utterance,
  // so quotes that span two consecutive turns can still be found.
  const tokens: string[] = [];
  const owner: number[] = [];
  utterances.forEach((u, idx) => {
    for (const t of normalizeTokens(u.text)) {
      tokens.push(t);
      owner.push(idx);
    }
  });

  const windowSize = Math.ceil(q.length * 1.5) + 2;
  let best = { score: 0, startToken: -1 };

  for (let i = 0; i < tokens.length; i++) {
    // cheap prefilter: window must start near a token the quote contains
    if (!q.includes(tokens[i])) continue;
    const window = tokens.slice(i, i + windowSize);
    const score = lcsLength(q, window) / q.length;
    // Windows are longer than the quote, so several starts just before the match
    // score equally. Within the same region prefer the latest one, which begins
    // at the quote's first matched word — that's the timestamp we want to seek to.
    const sameRegion = best.startToken >= 0 && i - best.startToken < windowSize;
    if (score > best.score || (score === best.score && score > 0 && sameRegion)) {
      best = { score, startToken: i };
    }
  }

  if (best.startToken < 0) {
    return { verified: false, start: null, utteranceIndex: null, score: 0 };
  }

  const utteranceIndex = owner[best.startToken];
  return {
    verified: best.score >= MATCH_THRESHOLD,
    start: utterances[utteranceIndex].start,
    utteranceIndex,
    score: Math.round(best.score * 100) / 100,
  };
}
