import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CallTable } from "@/components/CallTable";
import { SalesHeader, withRange } from "@/components/SalesHeader";
import { Card, cx } from "@/components/ui";
import { GRADE_LABEL, initials, score100, scoreTone } from "@/lib/format";
import { inRange, missedSteps, parseRange, repStats } from "@/lib/insights";
import { byNewest, listCalls } from "@/lib/queries";

export const dynamic = "force-dynamic";

const pct = (n: number | null) => (n == null ? "-" : `${Math.round(n * 100)}%`);

/** One rep's scorecard: how they're doing, what to coach, and every call they took. */
export default async function RepPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const name = decodeURIComponent((await params).name);
  const range = parseRange((await searchParams).range);
  const all = inRange(await listCalls(), range);
  const rep = repStats(all).find((r) => r.name === name);
  if (!rep) notFound();

  const calls = all.filter((c) => c.analysis?.repName === name).sort(byNewest);
  const coach = missedSteps(
    calls.filter((c): c is typeof c & { analysis: NonNullable<typeof c.analysis> } =>
      Boolean(c.analysis && c.status === "complete"),
    ),
    1,
  ).slice(0, 5);
  const link = (href: string) => withRange(href, range);
  const best = calls.find((c) => c.id === rep.bestCallId);

  return (
    <>
      <SalesHeader
        active="reps"
        range={range}
        basePath={link(`/sales/reps/${encodeURIComponent(name)}`)}
      />
      <Link
        href={link("/sales/reps")}
        className="inline-flex items-center gap-1 text-[15px] text-accent"
      >
        <ChevronLeft className="size-4" strokeWidth={2.2} aria-hidden />
        Reps
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
            {initials(name)}
          </span>
          <div>
            <h2 className="text-[28px] font-bold tracking-tight">{name}</h2>
            <p className="text-[15px] text-muted">
              {rep.calls} call{rep.calls === 1 ? "" : "s"} · {rep.graded} graded
            </p>
          </div>
        </div>
        <Link
          href={link(`/sales/calls?rep=${encodeURIComponent(name)}`)}
          className="text-[15px] font-medium text-accent"
        >
          Open in Call Log →
        </Link>
      </div>

      <div className="mt-6 space-y-6">
        <Card accent className="p-6">
          <h3 className="text-[20px] font-semibold tracking-tight">Scorecard</h3>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            <Metric
              label="Avg Call Score"
              value={score100(rep.avgPct)}
              tone={scoreTone(rep.avgPct)}
            />
            <Metric label="Close %" value={pct(rep.closeRate)} />
            <Metric label="Save %" value={pct(rep.saveRate)} />
            <div>
              <p className="text-[14px] font-medium text-[#3a3a3c]">Grades</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5 text-sm font-semibold">
                <span className="rounded-full bg-gold-soft px-2.5 py-1 text-gold">
                  {rep.gradeMix.gold} {GRADE_LABEL.gold}
                </span>
                <span className="rounded-full bg-green-soft px-2.5 py-1 text-green">
                  {rep.gradeMix.green} {GRADE_LABEL.green}
                </span>
                <span className="rounded-full bg-red-soft px-2.5 py-1 text-red">
                  {rep.gradeMix.below} {GRADE_LABEL.below}
                </span>
              </div>
            </div>
            <div>
              <p className="text-[14px] font-medium text-[#3a3a3c]">Best call</p>
              {best?.analysis ? (
                <>
                  <Link
                    href={`/sales/calls/${best.id}`}
                    className="mt-1 block text-[28px] font-semibold tracking-tight text-accent hover:underline"
                  >
                    {best.label}
                  </Link>
                  <p className="text-xs text-faint">
                    {best.analysis.score} of {best.analysis.maxScore} steps
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[28px] font-semibold tracking-tight">-</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-[20px] font-semibold tracking-tight">Coach {name} on</h3>
          {coach.length === 0 ? (
            <p className="mt-3 text-[15px] text-muted">
              No repeated misses. Every scorecard step is being hit.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {coach.map((s) => (
                <li
                  key={`${s.rubricId}:${s.itemId}`}
                  className="flex flex-wrap items-baseline justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium">{s.label}</p>
                    <p className="text-sm text-muted">
                      Hear it on{" "}
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
                  <span className="text-sm tabular-nums text-muted">
                    missed {s.missed}/{s.graded}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-[20px] font-semibold tracking-tight">Calls</h3>
          <div className="mt-4">
            <CallTable
              calls={calls}
              empty={
                <p className="py-10 text-center text-sm text-muted">No calls in this window.</p>
              }
            />
          </div>
        </Card>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-[14px] font-medium text-[#3a3a3c]">{label}</p>
      <p className={cx("mt-1 text-[28px] font-semibold tracking-tight tabular-nums", tone)}>
        {value}
      </p>
      {sub && <p className="text-xs text-faint">{sub}</p>}
    </div>
  );
}
