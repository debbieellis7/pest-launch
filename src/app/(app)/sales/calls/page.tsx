import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CallTable } from "@/components/CallTable";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Pagination } from "@/components/Pagination";
import { RepFilter } from "@/components/RepFilter";
import { SalesHeader } from "@/components/SalesHeader";
import { UploadButton } from "@/components/UploadButton";
import { Card, cx } from "@/components/ui";
import { TYPE_LABEL, isProcessing, score100, type CallType } from "@/lib/format";
import { countCalls, maxCalls } from "@/lib/calls";
import { inRange, parseRange } from "@/lib/insights";
import { PAGE_SIZE, PAGE_SIZES, parsePageSize } from "@/lib/pagination";
import { listCallPage, listCallStats, type CallSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Search = {
  type?: string;
  dir?: string;
  rep?: string;
  review?: string;
  open?: string;
  day?: string;
  range?: string;
  page?: string;
  per?: string;
};

const TYPES = Object.keys(TYPE_LABEL) as CallType[];

// Stats card tiles: light diagonal gradients with text in the same hue.
const TILE = {
  inbound: "from-blue-100 to-blue-300 text-blue-900",
  outbound: "from-indigo-100 to-indigo-300 text-indigo-900",
  good: "from-emerald-100 to-emerald-300 text-emerald-900",
  warn: "from-amber-100 to-amber-300 text-amber-900",
  bad: "from-rose-100 to-rose-300 text-rose-900",
  neutral: "from-slate-100 to-slate-300 text-slate-800",
};
const TYPE_TINT: Record<CallType, string> = {
  sales: "from-emerald-100 to-emerald-300 text-emerald-900",
  service: "from-sky-100 to-sky-300 text-sky-900",
  billing: "from-violet-100 to-violet-300 text-violet-900",
  retention: "from-orange-100 to-orange-300 text-orange-900",
  other: TILE.neutral,
};
const needsReview = (c: CallSummary) => Boolean(c.analysis?.needsReview) || c.status === "failed";

export default async function CallLogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const range = parseRange(params.range);
  // Demo spend guard: total calls across all time, not just this range.
  const [allStats, uploaded] = await Promise.all([listCallStats(), countCalls()]);
  const calls = inRange(allStats, range);
  const max = maxCalls();
  const remaining = Math.max(0, max - uploaded);

  const type = TYPES.includes(params.type as CallType) ? (params.type as CallType) : null;
  const dir = params.dir === "inbound" || params.dir === "outbound" ? params.dir : null;
  const rep = params.rep ?? null;
  const review = params.review === "1";
  const open = params.open === "1";
  const today = params.day === "today";

  // The table asks the database for one page only; the stats above cover every call.
  const per = parsePageSize(params.per);
  const shown = await listCallPage(
    {
      since: new Date(Date.now() - (range === "7d" ? 7 : 30) * 86_400_000),
      today,
      type,
      // "service" also covers billing when coming from a Sales Leaks link with open=1
      includeBilling: open && type === "service",
      dir,
      rep,
      open,
      review,
    },
    params.page,
    per,
  );

  const count = (pred: (c: CallSummary) => boolean) => calls.filter(pred).length;
  const reps = [
    ...new Set(calls.map((c) => c.analysis?.repName).filter(Boolean)),
  ].sort() as string[];
  const graded = calls.filter((c) => c.analysis?.grade && c.analysis.maxScore);
  const avgPct = graded.length
    ? graded.reduce((s, c) => s + (c.analysis!.score ?? 0) / c.analysis!.maxScore!, 0) /
      graded.length
    : null;
  const transcribed = count((c) => c.status === "complete" || c.status === "analyzing");

  const current: Search = {
    type: type ?? undefined,
    dir: dir ?? undefined,
    rep: rep ?? undefined,
    review: review ? "1" : undefined,
    open: open ? "1" : undefined,
    day: today ? "today" : undefined,
    range: range === "30d" ? undefined : range,
    per: per === PAGE_SIZE ? undefined : String(per),
  };
  const href = (next: Partial<Search>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...next })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/sales/calls?${s}` : "/sales/calls";
  };
  const filtered = Boolean(type || dir || rep || review || open || today);

  return (
    <>
      <AutoRefresh active={calls.some((c) => isProcessing(c.status) && !c.stalled)} />
      <SalesHeader active="calls" range={range} basePath={href({})} />

      <Card accent className="mb-6 p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Stat
            label="Inbound"
            tint={TILE.inbound}
            value={count((c) => c.analysis?.direction === "inbound")}
          />
          <Stat
            label="Outbound"
            tint={TILE.outbound}
            value={count((c) => c.analysis?.direction === "outbound")}
          />
          {TYPES.map((t) => (
            <Stat
              key={t}
              label={TYPE_LABEL[t]}
              tint={TYPE_TINT[t]}
              value={count((c) => c.analysis?.callType === t)}
            />
          ))}
          <Stat
            label="Avg Score"
            tint={
              avgPct == null
                ? TILE.neutral
                : avgPct >= 0.9
                  ? TILE.good
                  : avgPct >= 0.75
                    ? TILE.warn
                    : TILE.bad
            }
            value={score100(avgPct)}
          />
          <Stat
            label="Needs Review"
            tint={count(needsReview) ? TILE.warn : TILE.neutral}
            value={count(needsReview)}
          />
        </div>
        <p className="mt-5 text-[13px] text-faint">
          {transcribed} call{transcribed === 1 ? "" : "s"} using PestLaunch diarized transcript (Rep
          / Caller). {graded.length} graded against your call scorecards. {uploaded} of {max}{" "}
          uploads used.
        </p>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[20px] font-semibold tracking-tight">Call history</h2>
          <UploadButton remaining={remaining} max={max} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip
            href={href({
              type: undefined,
              dir: undefined,
              day: undefined,
              review: undefined,
              open: undefined,
            })}
            active={!type && !dir && !today && !review && !open}
          >
            All
          </Chip>
          <Chip href={href({ day: today ? undefined : "today" })} active={today}>
            Today
          </Chip>
          <Chip
            href={href({ dir: dir === "inbound" ? undefined : "inbound" })}
            active={dir === "inbound"}
          >
            Inbound
          </Chip>
          <Chip
            href={href({ dir: dir === "outbound" ? undefined : "outbound" })}
            active={dir === "outbound"}
          >
            Outbound
          </Chip>
          {TYPES.map((t) => (
            <Chip key={t} href={href({ type: type === t ? undefined : t })} active={type === t}>
              {TYPE_LABEL[t]}
            </Chip>
          ))}
          <RepFilter
            reps={reps}
            value={rep}
            hrefFor={Object.fromEntries([
              ["", href({ rep: undefined })],
              ...reps.map((r) => [r, href({ rep: r })]),
            ])}
          />
          <Chip href={href({ review: review ? undefined : "1" })} active={review} tone="warn">
            Needs review
          </Chip>
          {open && (
            <Chip href={href({ open: undefined })} active>
              Needs follow-up ✕
            </Chip>
          )}
          <div className="ml-auto">
            <PageSizeSelect
              value={per}
              hrefFor={Object.fromEntries(
                PAGE_SIZES.map((n) => [
                  String(n),
                  href({ per: n === PAGE_SIZE ? undefined : String(n) }),
                ]),
              )}
            />
          </div>
        </div>

        <div className="mt-5">
          <CallTable
            calls={shown.calls}
            empty={
              <div className="py-16 text-center">
                <p className="text-[15px] font-medium">
                  {filtered || calls.length ? "No calls match these filters" : "No calls yet"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {filtered ? (
                    <Link
                      href={href({
                        type: undefined,
                        dir: undefined,
                        rep: undefined,
                        review: undefined,
                        open: undefined,
                        day: undefined,
                      })}
                      className="text-accent"
                    >
                      Clear filters
                    </Link>
                  ) : (
                    "Upload a recording and it'll be transcribed, graded and coached in a couple of minutes."
                  )}
                </p>
              </div>
            }
          />
          <Pagination
            page={shown.meta.page}
            pages={shown.meta.pages}
            from={shown.meta.from}
            to={shown.meta.to}
            total={shown.total}
            hrefFor={(n) => href({ page: n > 1 ? String(n) : undefined })}
          />
        </div>
      </Card>
    </>
  );
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: React.ReactNode;
  /** Gradient stops plus text colour, e.g. "from-sky-100 to-sky-300 text-sky-900". */
  tint: string;
}) {
  return (
    <div className={cx("min-w-0 rounded-xl bg-linear-to-br px-4 py-3.5 ring-1 ring-black/5", tint)}>
      <p className="text-[15px] font-bold tracking-tight opacity-80">{label}</p>
      <p className="mt-1 text-[30px] font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

function Chip({
  href,
  active,
  tone,
  children,
}: {
  href: string;
  active: boolean;
  tone?: "warn";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[14px] font-medium shadow-[0_1px_1px_rgba(0,0,0,0.03)] ring-1 transition-colors",
        active
          ? tone === "warn"
            ? "bg-[#fff4e0] font-medium text-[#a05a00] ring-[#f5a623]/40"
            : "bg-accent-soft font-medium text-accent ring-accent/25"
          : "bg-white text-ink ring-line hover:bg-black/[0.03]",
      )}
    >
      {children}
    </Link>
  );
}
