import { QUADRANT_LABEL, formatDuration } from "@/lib/format";
import { RUBRICS } from "@/lib/rubrics";
import type { Quadrant, RubricId, ScoredItem } from "@/lib/rubrics/types";
import { Card, cx } from "../ui";

const QUADRANTS = Object.keys(QUADRANT_LABEL) as Quadrant[];

export function Scorecard({
  items,
  rubricId,
  score,
  max,
  onSeek,
}: {
  items: ScoredItem[];
  rubricId: string | null;
  score: number | null;
  max: number | null;
  onSeek: (sec: number) => void;
}) {
  const rubric = rubricId ? RUBRICS[rubricId as RubricId] : null;

  return (
    <Card className="p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Scorecard</h2>
          {rubric && <p className="mt-0.5 text-sm text-muted">{rubric.name}</p>}
        </div>
        <p className="text-[15px] tabular-nums text-muted">
          <span className="text-[22px] font-semibold text-ink">{score}</span> of {max} steps
        </p>
      </div>

      <div className="mt-5 space-y-6">
        {QUADRANTS.map((q) => {
          const group = items.filter((i) => i.quadrant === q);
          if (group.length === 0) return null;
          const earned = group.filter((i) => i.earned).length;
          return (
            <div key={q}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
                  {QUADRANT_LABEL[q]}
                </h3>
                <span
                  className={cx(
                    "text-xs font-medium tabular-nums",
                    earned === group.length ? "text-green" : "text-muted",
                  )}
                >
                  {earned}/{group.length}
                </span>
              </div>
              <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
                {group.map((item) => (
                  <ItemRow key={item.id} item={item} onSeek={onSeek} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ItemRow({ item, onSeek }: { item: ScoredItem; onSeek: (sec: number) => void }) {
  const status = item.status;
  return (
    <li className="flex gap-3 px-4 py-3">
      <StatusIcon status={status} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className={cx("text-[15px] font-medium", status === "na" && "text-muted")}>
            {item.label}
          </p>
          {status === "na" && <span className="text-xs text-faint">N/A · earned</span>}
        </div>
        {(item.note || item.reason) && (
          <p className="mt-0.5 text-sm text-muted">{item.note ?? item.reason}</p>
        )}
        {item.evidence &&
          (item.evidenceStart != null ? (
            <button
              type="button"
              onClick={() => onSeek(item.evidenceStart!)}
              className="mt-2 block w-full cursor-pointer rounded-lg bg-black/[0.03] px-3 py-2 text-left text-sm italic text-[#3a3a3c] hover:bg-accent-soft"
            >
              &ldquo;{item.evidence}&rdquo;
              <span className="ml-2 not-italic tabular-nums text-accent">
                ▶ {formatDuration(item.evidenceStart)}
              </span>
            </button>
          ) : (
            // Quote not found in the transcript, so there's no moment to jump to.
            <p className="mt-2 rounded-lg bg-black/[0.03] px-3 py-2 text-sm italic text-[#3a3a3c]">
              &ldquo;{item.evidence}&rdquo;
            </p>
          ))}
        {item.evidenceVerified === false && (
          <p className="mt-1 text-xs text-[#a05a00]">
            This quote couldn&apos;t be matched in the transcript. Check the recording.
          </p>
        )}
      </div>
    </li>
  );
}

function StatusIcon({ status }: { status: ScoredItem["status"] }) {
  const common = "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full";
  if (status === "met") {
    return (
      <span className={cx(common, "bg-green text-white")} aria-label="Met">
        <svg
          viewBox="0 0 24 24"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.2}
          aria-hidden
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
    );
  }
  if (status === "not_met") {
    return (
      <span className={cx(common, "bg-red text-white")} aria-label="Missed">
        <svg
          viewBox="0 0 24 24"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.2}
          aria-hidden
        >
          <path d="M7 7l10 10M17 7 7 17" />
        </svg>
      </span>
    );
  }
  return (
    <span className={cx(common, "bg-black/[0.08] text-muted")} aria-label="Not applicable">
      <span className="h-0.5 w-2 rounded bg-current" />
    </span>
  );
}
