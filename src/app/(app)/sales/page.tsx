import Link from "next/link";
import { SalesHeader, withRange } from "@/components/SalesHeader";
import { Card, ResultText, cx } from "@/components/ui";
import { buildInsights, inRange, parseRange, salesLeaks, type Insights } from "@/lib/insights";
import { GRADE_LABEL } from "@/lib/format";
import { listCalls } from "@/lib/queries";

export const dynamic = "force-dynamic";

const pct = (n: number | null) => (n == null ? "-" : `${Math.round(n * 100)}%`);

function toneFor(value: number | null, target: number): string | undefined {
  if (value == null) return undefined;
  return value >= target ? "text-green" : value >= target * 0.6 ? "text-gold" : "text-red";
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const range = parseRange((await searchParams).range);
  const calls = inRange(await listCalls(), range);
  const i = buildInsights(calls);
  const link = (href: string) => withRange(href, range);
  const pending = calls.length - i.totals.analyzed;

  return (
    <>
      <SalesHeader active="overview" range={range} basePath={link("/sales")} />
      <div className="space-y-6">
        {pending > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-soft px-5 py-3.5 text-[15px] ring-1 ring-accent/15">
            <span>
              <span className="font-semibold">
                {pending} call{pending === 1 ? "" : "s"}
              </span>{" "}
              {pending === 1 ? "isn't" : "aren't"} analyzed yet. The numbers below fill in as they
              are.
            </span>
            <Link href={link("/sales/calls")} className="font-medium text-accent">
              Open the Call Log →
            </Link>
          </div>
        )}
        <BiggestIssueCard i={i} link={link} />
        <Scorecard i={i} />
        <Leaks i={i} link={link} />
        <FollowUps i={i} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Cancellations i={i} />
          <Quality i={i} />
        </div>
      </div>
    </>
  );
}

/** The one thing the owner should look at first (ranked in `biggestIssue`). */
function BiggestIssueCard({ i, link }: { i: Insights; link: (href: string) => string }) {
  const issue = i.biggestIssue;
  if (!issue) return null;
  const bad = issue.tone === "bad";
  return (
    <Card className={cx("border-l-[3px] p-6", bad ? "border-red" : "border-green")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p
            className={cx(
              "text-[12px] font-bold uppercase tracking-[0.06em]",
              bad ? "text-red" : "text-green",
            )}
          >
            {bad ? "Biggest issue" : "Looking good"}
          </p>
          <p className="mt-1 text-[22px] font-semibold tracking-tight">{issue.title}</p>
          <p className="mt-0.5 text-[15px] text-muted">
            <span className="font-medium text-ink">{issue.metric}</span> · {issue.detail}
          </p>
        </div>
        <Link
          href={link(issue.href)}
          className="shrink-0 rounded-xl bg-accent px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          {issue.href.startsWith("/sales/calls/") ? "Open the call →" : "See the calls →"}
        </Link>
      </div>
    </Card>
  );
}

function Scorecard({ i }: { i: Insights }) {
  return (
    <Card accent className="p-6">
      <h2 className="text-[20px] font-semibold tracking-tight">Scorecard</h2>
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Calls Analyzed" value={String(i.totals.analyzed)} />
        <Metric label="New Leads" value={String(i.totals.newLeads)} />
        <Metric
          label="Close %"
          value={pct(i.sales.closeRate)}
          tone={toneFor(i.sales.closeRate, 0.5)}
        />
        <Metric
          label="Saved %"
          value={pct(i.retention.saveRate)}
          tone={toneFor(i.retention.saveRate, 0.6)}
        />
        <Metric
          label="Follow-Ups Due"
          value={String(i.followUps.length)}
          tone={i.followUps.length ? "text-gold" : "text-green"}
        />
      </div>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[14px] font-medium text-[#3a3a3c]">{label}</p>
      <p className={cx("mt-1 text-[30px] font-semibold tracking-tight tabular-nums", tone)}>
        {value}
      </p>
    </div>
  );
}

function Leaks({ i, link }: { i: Insights; link: (href: string) => string }) {
  const leaks = salesLeaks(i);
  return (
    <Card accent className="p-6">
      <h2 className="text-[20px] font-semibold tracking-tight">Sales Leaks</h2>
      {leaks.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted">
          {i.totals.analyzed
            ? "Nothing slipping right now. Every analyzed call ended booked, saved or resolved."
            : "Missed bookings, lost cancellations and unresolved issues show up here."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {leaks.map((leak) => (
            <li
              key={leak.title}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-black/[0.03] px-5 py-4 ring-1 ring-black/[0.04]"
            >
              <div className="min-w-0">
                <p className="text-[17px] font-semibold tracking-tight">{leak.title}</p>
                <p className="mt-0.5 text-[15px] text-muted">{leak.detail}</p>
              </div>
              <Link
                href={link(leak.href)}
                className="shrink-0 rounded-xl bg-accent px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm transition hover:brightness-110"
              >
                {leak.action} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FollowUps({ i }: { i: Insights }) {
  const list = i.followUps;
  return (
    <Card className="p-6">
      <h2 className="text-[20px] font-semibold tracking-tight">Follow-Ups Due</h2>
      {list.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted">Nothing waiting on a call back.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-black/[0.03] px-5 py-3.5 ring-1 ring-black/[0.04]"
            >
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <p className="text-[15px] font-semibold uppercase tracking-tight">
                  {f.callerName ?? "Unknown caller"}
                  <span className="ml-2 text-xs font-normal normal-case text-faint">{f.label}</span>
                </p>
                <p className="mt-0.5 truncate text-[14px]">
                  <ResultText result={f.result} />
                  <span className="text-muted">
                    {" · "}
                    {f.nextSteps[0] ?? f.headline ?? "Follow up"}
                  </span>
                </p>
              </div>
              <Link
                href={`/sales/calls/${f.id}`}
                className="shrink-0 rounded-xl bg-accent px-4 py-2 text-[15px] font-semibold text-white shadow-sm transition hover:brightness-110"
              >
                {f.repName ? `Open → ${f.repName}` : "Open call →"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Cancellations({ i }: { i: Insights }) {
  const r = i.retention;
  const lostTotal = r.lostReasons.reduce((s, x) => s + x.count, 0);
  return (
    <Card className="p-6">
      <h2 className="text-[20px] font-semibold tracking-tight">Why customers cancel</h2>
      <p className="mt-0.5 text-sm text-muted">
        {r.calls
          ? `${r.calls} cancel call${r.calls === 1 ? "" : "s"} · ${r.saved} saved`
          : "No cancel calls yet."}
      </p>
      {lostTotal > 0 && (
        <ul className="mt-5 space-y-3">
          {r.lostReasons.map((x) => (
            <li key={x.reason}>
              <div className="flex items-baseline justify-between text-[15px]">
                <span className="font-medium">
                  {x.label}
                  {x.unavoidable && (
                    <span className="ml-2 text-xs font-normal text-faint">can&apos;t be saved</span>
                  )}
                </span>
                <span className="text-sm tabular-nums text-muted">{x.count} lost</span>
              </div>
              <Bar value={x.count / lostTotal} tone={x.unavoidable ? "bg-black/20" : "bg-red/80"} />
            </li>
          ))}
        </ul>
      )}
      {r.winningOffers.length > 0 && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-sm font-medium">Offers that saved customers</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.winningOffers.map((o) => (
              <span
                key={o.offer}
                className="rounded-full bg-green-soft px-2.5 py-1 text-xs font-medium text-green"
              >
                {o.label} · {o.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Quality({ i }: { i: Insights }) {
  return (
    <Card className="p-6">
      <h2 className="text-[20px] font-semibold tracking-tight">Call quality</h2>
      <p className="mt-0.5 text-sm text-muted">Share of scorecard steps reps hit, by call type.</p>
      {i.scores.length === 0 ? (
        <p className="mt-5 text-sm text-muted">No graded calls yet.</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {i.scores.map((s) => (
            <li key={s.rubricId}>
              <div className="flex items-baseline justify-between text-[15px]">
                <span className="font-medium">
                  {s.rubricId === "sales"
                    ? "Sales calls"
                    : s.rubricId === "retention"
                      ? "Retention calls"
                      : "Service & billing calls"}
                  <span className="ml-2 text-xs font-normal text-faint">{s.calls} graded</span>
                </span>
                <span className="text-sm tabular-nums text-muted">{Math.round(s.pct * 100)}%</span>
              </div>
              <Bar
                value={s.pct}
                tone={s.pct >= 0.9 ? "bg-green" : s.pct >= 0.75 ? "bg-gold" : "bg-red"}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex flex-wrap gap-1.5 border-t border-line pt-4 text-xs font-medium">
        <span className="rounded-full bg-gold-soft px-2.5 py-1 text-gold">
          {i.gradeMix.gold} {GRADE_LABEL.gold}
        </span>
        <span className="rounded-full bg-green-soft px-2.5 py-1 text-green">
          {i.gradeMix.green} {GRADE_LABEL.green}
        </span>
        <span className="rounded-full bg-red-soft px-2.5 py-1 text-red">
          {i.gradeMix.below} {GRADE_LABEL.below}
        </span>
      </div>
    </Card>
  );
}

function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
      <div
        className={cx("h-full rounded-full", tone)}
        style={{ width: `${Math.max(4, value * 100)}%` }}
      />
    </div>
  );
}
