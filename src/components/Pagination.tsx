import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageNumbers } from "@/lib/pagination";
import { cx } from "./ui";

/** "Showing 1–10 of 23" plus Previous / page numbers / Next. Links keep the current filters. */
export function Pagination({
  page,
  pages,
  from,
  to,
  total,
  hrefFor,
  noun = "calls",
}: {
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  hrefFor: (page: number) => string;
  noun?: string;
}) {
  if (total === 0) return null;
  const step = (target: number, label: string, icon: React.ReactNode, side: "prev" | "next") =>
    target < 1 || target > pages ? (
      <span
        aria-disabled
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-faint"
      >
        {side === "prev" && icon}
        {label}
        {side === "next" && icon}
      </span>
    ) : (
      <Link
        href={hrefFor(target)}
        scroll={false}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink hover:bg-black/[0.04]"
      >
        {side === "prev" && icon}
        {label}
        {side === "next" && icon}
      </Link>
    );

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
    >
      <p className="text-sm text-muted">
        Showing <span className="font-medium text-ink tabular-nums">{from}</span>
        {to > from && (
          <>
            –<span className="font-medium text-ink tabular-nums">{to}</span>
          </>
        )}{" "}
        of <span className="font-medium text-ink tabular-nums">{total}</span> {noun}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          {step(page - 1, "Previous", <ChevronLeft className="size-4" aria-hidden />, "prev")}
          {pageNumbers(page, pages).map((n, i) =>
            n === "gap" ? (
              <span key={`gap${i}`} className="px-1.5 text-sm text-faint">
                …
              </span>
            ) : (
              <Link
                key={n}
                href={hrefFor(n)}
                scroll={false}
                aria-current={n === page ? "page" : undefined}
                className={cx(
                  "grid size-8 place-items-center rounded-lg text-sm font-medium tabular-nums",
                  n === page
                    ? "bg-accent-soft text-accent ring-1 ring-accent/20"
                    : "text-ink hover:bg-black/[0.04]",
                )}
              >
                {n}
              </Link>
            ),
          )}
          {step(page + 1, "Next", <ChevronRight className="size-4" aria-hidden />, "next")}
        </div>
      )}
    </nav>
  );
}
