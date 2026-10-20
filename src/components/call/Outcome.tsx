import type { ReactNode } from "react";
import {
  CANCEL_REASON_LABEL,
  OBJECTION_LABEL,
  formatMoney,
  offerLabel,
  type CallType,
} from "@/lib/format";
import type { CallDetail } from "@/lib/queries";
import { Card, ResultText } from "../ui";

type Full = NonNullable<CallDetail["full"]>;

export function Outcome({ full, callType }: { full: Full; callType: CallType }) {
  const o = full.outcome;
  const d = full.details;
  const facts: [string, ReactNode][] = [];

  if (o?.sale) {
    const s = o.sale;
    if (s.service) facts.push(["Service", s.service]);
    const initial = formatMoney(s.initial_price);
    const recurring = formatMoney(s.recurring_price);
    if (initial) facts.push(["Initial", initial]);
    if (recurring)
      facts.push(["Recurring", `${recurring}${s.frequency ? ` · ${s.frequency}` : ""}`]);
    if (s.appointment) facts.push(["First service", s.appointment]);
    if (s.reason_not_booked) facts.push(["Why not booked", s.reason_not_booked]);
  }
  if (o?.retention) {
    const r = o.retention;
    facts.push([
      "Reason for cancelling",
      <span key="r">
        <span className="font-medium">
          {CANCEL_REASON_LABEL[r.cancel_reason] ?? r.cancel_reason}
        </span>
        {r.cancel_reason_detail && <span className="text-muted"> · {r.cancel_reason_detail}</span>}
      </span>,
    ]);
    facts.push([
      "Save offers made",
      r.offers_made.length ? (
        <span key="o" className="flex flex-wrap gap-1.5">
          {r.offers_made.map((id) => (
            <span
              key={id}
              className={
                id === r.offer_accepted
                  ? "rounded-full bg-green-soft px-2.5 py-0.5 text-xs font-medium text-green"
                  : "rounded-full bg-black/[0.05] px-2.5 py-0.5 text-xs"
              }
            >
              {offerLabel(id)}
              {id === r.offer_accepted && " ✓"}
            </span>
          ))}
        </span>
      ) : (
        <span key="o" className="font-medium text-red">
          None offered
        </span>
      ),
    ]);
  }
  if (o?.service) {
    facts.push(["Request", o.service.request]);
    if (o.service.resolution) facts.push(["Resolution", o.service.resolution]);
  }
  if (d?.pests.length) facts.push(["Pests", d.pests.join(", ")]);
  if (d && d.objections.length) {
    facts.push([
      "Objections",
      <ul key="obj" className="space-y-1">
        {d.objections.map((ob, i) => (
          <li key={i}>
            <span className="font-medium">{OBJECTION_LABEL[ob.type] ?? ob.type}</span>
            <span className={ob.handled ? "text-green" : "text-red"}>
              {ob.handled ? " · handled" : " · not handled"}
            </span>
            <span className="block italic text-muted">&ldquo;{ob.quote}&rdquo;</span>
          </li>
        ))}
      </ul>,
    ]);
  }

  return (
    <Card accent className="p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
        {callType === "retention"
          ? "Retention outcome"
          : callType === "sales"
            ? "Sales outcome"
            : "Outcome"}
      </p>
      <p className="mt-2 text-[22px] font-semibold leading-snug tracking-tight">
        <ResultText result={o?.result ?? null} />
        {o?.headline && <span className="text-ink"> · {o.headline}</span>}
      </p>
      {full.summary && (
        <p className="mt-3 text-[15px] leading-relaxed text-[#3a3a3c]">{full.summary}</p>
      )}

      {facts.length > 0 && (
        <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-line pt-5 sm:grid-cols-[160px_1fr]">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="text-sm">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {o && o.next_steps.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm font-medium">Next steps</p>
          <ul className="mt-1.5 space-y-1 text-sm text-[#3a3a3c]">
            {o.next_steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-faint">→</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
