// Display labels and formatting shared by the UI. Pure, so it's safe in client components.
import { SAVE_OFFERS } from "./rubrics/retention";

export type CallType = "sales" | "service" | "billing" | "retention" | "other";
export type Grade = "gold" | "green" | "below";
export type CallStatus = "uploaded" | "transcribing" | "analyzing" | "complete" | "failed";

export const TYPE_LABEL: Record<CallType, string> = {
  sales: "Sales",
  service: "Service",
  billing: "Billing",
  retention: "Retention",
  other: "Other",
};

/** Grade words a manager reads without knowing the manual's colour scheme. */
export const GRADE_LABEL: Record<Grade, string> = {
  gold: "Perfect (Gold)",
  green: "On standard",
  below: "Below standard",
};

/** "0 Gold · 1 Green · 3 Below" → "1 on standard · 3 below standard" (zeros left out). */
export function gradeSummary(mix: Record<Grade, number>): string {
  const parts = (["gold", "green", "below"] as Grade[])
    .filter((g) => mix[g] > 0)
    .map((g) => `${mix[g]} ${GRADE_LABEL[g].replace(/^\w/, (c) => c.toLowerCase())}`);
  return parts.join(" · ") || "No graded calls";
}

export const STATUS_LABEL: Record<CallStatus, string> = {
  uploaded: "Queued",
  transcribing: "Transcribing",
  analyzing: "Analyzing",
  complete: "Complete",
  failed: "Failed",
};

export const RESULT_LABEL: Record<string, string> = {
  booked: "Booked",
  not_booked: "Not booked",
  follow_up: "Follow-up",
  saved: "Saved",
  cancelled: "Cancelled",
  resolved: "Resolved",
  unresolved: "Unresolved",
  no_outcome: "No outcome",
};

/** Whether a result is good news for the business (drives green vs red). */
export const RESULT_TONE: Record<string, "good" | "bad" | "neutral"> = {
  booked: "good",
  saved: "good",
  resolved: "good",
  not_booked: "bad",
  cancelled: "bad",
  unresolved: "bad",
  follow_up: "neutral",
  no_outcome: "neutral",
};

export const CANCEL_REASON_LABEL: Record<string, string> = {
  price: "Price",
  pests_not_resolved: "Pests not resolved",
  service_experience: "Service experience",
  moving: "Moving",
  financial_hardship: "Financial hardship",
  switching_provider: "Switching provider",
  no_longer_needed: "No longer needed",
  deceased: "Customer passed away",
  other: "Other",
};

export const OBJECTION_LABEL: Record<string, string> = {
  price: "Price",
  spouse_or_partner: "Ask spouse/partner",
  shopping_around: "Shopping around",
  timing: "Timing",
  contract: "Contract",
  diy: "Do it themselves",
  other: "Other",
};

const OFFER_LABEL: Record<string, string> = Object.fromEntries(
  SAVE_OFFERS.map((o) => [o.id, o.label]),
);

export function offerLabel(id: string): string {
  return OFFER_LABEL[id] ?? id;
}

export const QUADRANT_LABEL = {
  validation: "Validation",
  understand: "Understand",
  solve: "Solve",
  verify: "Verify",
} as const;

/** 75.4 → "1:15"; 3725 → "1:02:05". */
export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

export function formatMoney(n: number | null | undefined): string | null {
  if (n == null) return null;
  return `$${n % 1 === 0 ? n : n.toFixed(2)}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function isProcessing(status: string): boolean {
  return status === "uploaded" || status === "transcribing" || status === "analyzing";
}

/**
 * A run that hasn't moved for this long has died (e.g. the server hit its time limit, or the
 * browser closed before processing started). The pipeline lets such a call be claimed again.
 */
export const STALE_AFTER_MS = 10 * 60 * 1000;

export function isStalled(status: string, updatedAt: string, now = Date.now()): boolean {
  return isProcessing(status) && now - Date.parse(updatedAt) > STALE_AFTER_MS;
}

/**
 * A plain-English line for a failed call, by the stage that failed. The raw error is
 * technical (e.g. "Could not sign recording URL: Object not found"), so the UI keeps it
 * out of the message and only offers it on hover.
 */
export function friendlyError(error: string | null | undefined, stage?: string | null): string {
  if (error && /authentication|api key|apikey|401/i.test(error)) {
    return "The analysis service isn't configured yet. Add the API key, then retry.";
  }
  if (error && /timed? ?out|timeout/i.test(error)) return "Processing took too long. Try again.";
  if (stage === "upload") return "The recording file is missing. Upload it again.";
  if (stage === "transcribe") {
    return "We couldn't transcribe this recording. Retry, or check that it's a clear audio file.";
  }
  if (stage === "analyze") return "The analysis didn't finish. Retry.";
  return "Something went wrong while processing this call. Retry.";
}

/** Colour for a 0–1 score: green at Gold-ish, amber in the middle, red below. */
export function scoreTone(p: number | null): string {
  if (p == null) return "text-faint";
  return p >= 0.9 ? "text-green" : p >= 0.75 ? "text-gold" : "text-red";
}

/** A 0–1 call score as a number out of 100 ("86"), the way PestLaunch shows scores. */
/** Share of scorecard steps hit, as a percentage: 0.864 → "86%". */
export function score100(p: number | null | undefined): string {
  return p == null ? "-" : `${Math.round(p * 100)}%`;
}

/** "Jane Doe" → "JD"; "Sam" → "S". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
