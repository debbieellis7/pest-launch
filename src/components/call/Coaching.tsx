import { formatDuration } from "@/lib/format";
import type { Coaching as CoachingData } from "@/lib/queries";
import type { ScoredItem } from "@/lib/rubrics/types";
import { Card, Eyebrow } from "../ui";

export function Coaching({
  coaching,
  items,
  onSeek,
}: {
  coaching: CoachingData;
  items: ScoredItem[];
  onSeek: (sec: number) => void;
}) {
  const label = (id: string | null | undefined) => items.find((i) => i.id === id)?.label ?? null;
  const strengths = coaching.strengths ?? [];
  const fixes = coaching.fixes ?? [];
  if (!coaching.headline && strengths.length === 0 && fixes.length === 0) return null;

  return (
    <Card className="p-6">
      <Eyebrow>Coaching</Eyebrow>
      {coaching.headline && (
        <p className="mt-2 text-[19px] font-semibold leading-snug tracking-tight">
          {coaching.headline}
        </p>
      )}

      {fixes.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
            Next time
          </h3>
          <ol className="mt-2 space-y-3">
            {fixes.map((fix, i) => (
              <li key={i} className="rounded-xl ring-1 ring-line">
                <div className="px-4 pt-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[15px] font-semibold">
                      {i + 1}. {label(fix.item_id) ?? "Improve this step"}
                    </p>
                    {fix.at != null && (
                      <button
                        type="button"
                        onClick={() => onSeek(fix.at!)}
                        className="text-sm tabular-nums text-accent hover:underline"
                      >
                        ▶ Hear it at {formatDuration(fix.at)}
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[#3a3a3c]">{fix.what}</p>
                  <p className="mt-1 text-sm text-muted">{fix.why}</p>
                </div>
                <div className="mt-3 rounded-b-xl border-t border-line bg-accent-soft/60 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-accent">
                    Try saying
                  </p>
                  <p className="mt-1 text-[15px] leading-relaxed">&ldquo;{fix.say_this}&rdquo;</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {strengths.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
            What went well
          </h3>
          <ul className="mt-2 space-y-2">
            {strengths.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-green" />
                <span>
                  {s.what}
                  {s.quote && <span className="italic text-muted"> &ldquo;{s.quote}&rdquo;</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
