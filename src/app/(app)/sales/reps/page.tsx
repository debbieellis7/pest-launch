import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SalesHeader, withRange } from "@/components/SalesHeader";
import { Card, cx } from "@/components/ui";
import {
  buildInsights,
  coachingQueue,
  inRange,
  parseRange,
  repStats,
  teamOverview,
  type RepStats,
} from "@/lib/insights";
import { gradeSummary, initials, score100, scoreTone } from "@/lib/format";
import { listCalls } from "@/lib/queries";

export const dynamic = "force-dynamic";

const pct = (n: number | null) => (n == null ? "-" : `${Math.round(n * 100)}%`);

export default async function RepsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const range = parseRange((await searchParams).range);
  const calls = inRange(await listCalls(), range);
  const i = buildInsights(calls);
  const reps = repStats(calls);
  const team = teamOverview(i, reps);
  const queue = coachingQueue(i);
  const gradedReps = reps.filter((r) => r.graded > 0).length;
  const link = (href: string) => withRange(href, range);

  return (
    <>
      <SalesHeader active="reps" range={range} basePath={link("/sales/reps")} />
      <div className="space-y-6">
        <Card accent className="p-6">
          <h2 className="text-[20px] font-semibold tracking-tight">Team Overview</h2>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="Team Close Rate" value={pct(team.closeRate)} />
            <Metric label="Save Rate" value={pct(team.saveRate)} />
            <Metric
              label="Avg Call Score"
              value={score100(team.avgPct)}
              tone={scoreTone(team.avgPct)}
            />
            <Metric label="Calls Graded" value={String(team.graded)} />
            <Metric
              label="Top Performer"
              value={team.topPerformer ?? (team.graded ? "None on standard yet" : "-")}
            />
            <Metric
              label="Needs Coaching"
              value={
                team.needsCoaching.length === 0
                  ? "-"
                  : team.needsCoaching.length > 1 && team.needsCoaching.length === gradedReps
                    ? `All ${gradedReps} reps`
                    : team.needsCoaching.join(", ")
              }
              tone={team.needsCoaching.length ? "text-red" : undefined}
            />
          </div>
        </Card>

        <Card accent className="p-6">
          <h2 className="text-[20px] font-semibold tracking-tight">Coaching queue</h2>
          {queue.length === 0 ? (
            team.enoughForPatterns ? (
              <>
                <p className="mt-3 text-[24px] font-semibold tracking-tight">Nothing urgent</p>
                <p className="mt-1 text-[15px] text-muted">
                  No step is being missed on half or more of the calls in this window.
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-[24px] font-semibold tracking-tight">
                  Not enough calls yet
                </p>
                <p className="mt-1 text-[15px] text-muted">
                  Repeated misses show up here once a scorecard has 2 or more graded calls. Until
                  then, open each rep for what they missed.
                </p>
              </>
            )
          ) : (
            <ul className="mt-4 space-y-3">
              {queue.map((s) => (
                <li
                  key={`${s.rubricId}:${s.itemId}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-black/[0.03] px-5 py-4 ring-1 ring-black/[0.04]"
                >
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold tracking-tight">
                      {s.label}
                      <span className="ml-2 text-xs font-normal text-faint">
                        {s.rubricId === "sales"
                          ? "Sales scorecard"
                          : s.rubricId === "retention"
                            ? "Retention scorecard"
                            : "All Calls scorecard"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[15px] text-muted">
                      Missed on {s.missed} of {s.graded} calls · hear it on{" "}
                      {s.examples.map((ex, n) => (
                        <span key={ex.id}>
                          {n > 0 && ", "}
                          <Link
                            href={`/sales/calls/${ex.id}`}
                            className="text-accent hover:underline"
                          >
                            {ex.label}
                          </Link>
                        </span>
                      ))}
                    </p>
                  </div>
                  <span
                    className={cx(
                      "shrink-0 rounded-full px-3 py-1 text-sm font-semibold tabular-nums",
                      s.rate >= 0.75 ? "bg-red-soft text-red" : "bg-gold-soft text-gold",
                    )}
                  >
                    {Math.round(s.rate * 100)}% missed
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-[20px] font-semibold tracking-tight">Reps</h2>
          <p className="mt-0.5 text-[15px] text-muted">
            Click a row to open that rep&apos;s scorecard.
          </p>
          {reps.length === 0 ? (
            <p className="mt-6 text-sm text-muted">
              Reps are picked up automatically from how they answer the phone once calls are
              analyzed.
            </p>
          ) : (
            <RepTable reps={reps} link={link} />
          )}
        </Card>
      </div>
    </>
  );
}

// Same layout as PestLaunch's Reps table (Score last, big number out of 100),
// with call-based columns in place of CRM ones.
const GRID =
  "md:grid-cols-[1.5fr_0.55fr_0.7fr_0.7fr_0.8fr_1.5fr_1.15fr_20px] md:items-center md:gap-4";

function RepTable({ reps, link }: { reps: RepStats[]; link: (href: string) => string }) {
  return (
    <div className="mt-4">
      <div
        className={cx(
          "hidden border-b border-line pb-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-[#3a3a3c] md:grid [&>span]:whitespace-nowrap",
          GRID,
        )}
      >
        <span>Rep</span>
        <span>Calls</span>
        <span>Close %</span>
        <span>Save %</span>
        <span>Follow-ups</span>
        <span>Top misses</span>
        <span>Score</span>
        <span />
      </div>
      <ul>
        {reps.map((r) => (
          <li key={r.name} className="border-b border-line last:border-0">
            <Link
              href={link(`/sales/reps/${encodeURIComponent(r.name)}`)}
              className={cx(
                "-mx-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-xl px-3 py-3.5 transition-colors hover:bg-black/[0.025]",
                GRID,
              )}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-black/[0.05] text-xs font-semibold text-muted">
                  {initials(r.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{r.name}</p>
                  <p className="text-xs text-faint">
                    {r.calls} call{r.calls === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <span className="hidden text-[15px] tabular-nums md:block">{r.calls}</span>
              <span className="hidden text-[15px] tabular-nums md:block">{pct(r.closeRate)}</span>
              <span className="hidden text-[15px] tabular-nums md:block">{pct(r.saveRate)}</span>
              <span
                className={cx(
                  "hidden text-[15px] tabular-nums md:block",
                  r.followUps > 0 && "font-medium text-gold",
                )}
              >
                {r.followUps}
              </span>
              <div className="col-span-2 min-w-0 text-sm text-muted md:order-none md:col-span-1">
                {r.topMissed.length ? (
                  r.topMissed.slice(0, 2).map((s) => (
                    <p key={`${s.rubricId}:${s.itemId}`} className="truncate">
                      {s.label}{" "}
                      <span className="text-faint">
                        ({s.missed}/{s.graded})
                      </span>
                    </p>
                  ))
                ) : (
                  <p>-</p>
                )}
              </div>
              <div className="col-start-2 row-start-1 justify-self-end md:col-auto md:row-auto md:justify-self-start">
                <p
                  className={cx(
                    "text-[20px] font-semibold leading-tight tabular-nums",
                    scoreTone(r.avgPct),
                  )}
                >
                  {score100(r.avgPct)}
                </p>
                <p className="text-xs text-faint">{gradeSummary(r.gradeMix)}</p>
              </div>
              <ChevronRight className="hidden size-4 text-faint md:block" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[14px] font-medium text-[#3a3a3c]">{label}</p>
      <p className={cx("mt-1 text-[26px] font-semibold leading-tight tracking-tight", tone)}>
        {value}
      </p>
    </div>
  );
}
