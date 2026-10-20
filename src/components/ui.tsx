import type { ReactNode } from "react";
import {
  GRADE_LABEL,
  RESULT_LABEL,
  RESULT_TONE,
  STATUS_LABEL,
  TYPE_LABEL,
  type CallStatus,
  type CallType,
  type Grade,
} from "@/lib/format";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <section
      className={cx(
        "rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04]",
        accent && "border-l-[3px] border-accent",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[17px] font-semibold tracking-tight">{children}</h2>
      {aside}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cx("text-[11px] font-semibold uppercase tracking-[0.08em] text-accent", className)}
    >
      {children}
    </p>
  );
}

const TYPE_STYLE: Record<CallType, string> = {
  sales: "bg-[#e8f1fd] text-[#0058b0]",
  service: "bg-[#eef0ff] text-[#4b4fc4]",
  billing: "bg-[#f3ecfc] text-[#7d3cc4]",
  retention: "bg-[#fff1e6] text-[#b55400]",
  other: "bg-[#f0f0f2] text-muted",
};

export function TypePill({ type }: { type: CallType }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TYPE_STYLE[type],
      )}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}

const GRADE_STYLE: Record<Grade, string> = {
  gold: "bg-gold-soft text-gold ring-gold/25",
  green: "bg-green-soft text-green ring-green/25",
  below: "bg-red-soft text-red ring-red/25",
};

export function GradeBadge({
  grade,
  score,
  max,
  size = "sm",
}: {
  grade: Grade | null;
  score: number | null;
  max: number | null;
  size?: "sm" | "lg";
}) {
  if (!grade || score == null || max == null) {
    return <span className="text-sm text-faint">Not graded</span>;
  }
  const pill = (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset",
        size === "lg" ? "px-3.5 py-1.5 text-base" : "px-3 py-1.5 text-[13px] leading-none",
        GRADE_STYLE[grade],
      )}
      title={`${score} of ${max} scorecard steps hit`}
    >
      {GRADE_LABEL[grade]}
    </span>
  );
  const steps = (
    <span
      className={cx("tabular-nums", size === "lg" ? "text-sm text-muted" : "text-xs text-faint")}
    >
      {score} of {max} steps{size === "lg" ? " hit" : ""}
    </span>
  );
  return size === "lg" ? (
    <span className="inline-flex items-center gap-2">
      {pill}
      {steps}
    </span>
  ) : (
    // Table rows show the grade only; the step count is on hover and on the call page.
    pill
  );
}

export function ResultText({ result, className }: { result: string | null; className?: string }) {
  if (!result) return null;
  const tone = RESULT_TONE[result] ?? "neutral";
  return (
    <span
      className={cx(
        "font-medium",
        tone === "good" && "text-green",
        tone === "bad" && "text-red",
        tone === "neutral" && "text-muted",
        className,
      )}
    >
      {RESULT_LABEL[result] ?? result}
    </span>
  );
}

export function StatusBadge({ status, stalled }: { status: CallStatus; stalled?: boolean }) {
  if (status === "complete") return null;
  const failed = status === "failed";
  const stuck = !failed && stalled;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        failed
          ? "bg-red-soft text-red"
          : stuck
            ? "bg-gold-soft text-gold"
            : "bg-accent-soft text-accent",
      )}
    >
      {!failed && !stuck && <span className="size-1.5 animate-pulse rounded-full bg-accent" />}
      {stuck ? "Stalled" : STATUS_LABEL[status]}
    </span>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className={cx("mt-1 text-[28px] font-semibold tracking-tight tabular-nums", tone)}>
        {value}
      </p>
    </div>
  );
}
