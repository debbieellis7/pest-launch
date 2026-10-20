import Link from "next/link";
import type { Range } from "@/lib/insights";
import { AsOf, RefreshButton } from "./HeaderControls";
import { cx } from "./ui";

type Tab = "overview" | "reps" | "calls";

const TABS: { id: Tab | "pipeline"; label: string; href?: string }[] = [
  { id: "overview", label: "Overview", href: "/sales" },
  { id: "pipeline", label: "Pipeline" },
  { id: "reps", label: "Reps", href: "/sales/reps" },
  { id: "calls", label: "Call Log", href: "/sales/calls" },
];

/** Keeps the selected range when moving between tabs (30d is the default, so it's left off). */
export function withRange(href: string, range: Range): string {
  if (range === "30d") return href;
  return `${href}${href.includes("?") ? "&" : "?"}range=${range}`;
}

/** The "Sales" page header from PestLaunch OS: title, range toggle, refresh, and the tab strip. */
export function SalesHeader({
  active,
  range,
  basePath,
}: {
  active: Tab;
  range: Range;
  /** Current path (with any filters) so the 7d/30d toggle keeps them. */
  basePath: string;
}) {
  const toggle = (r: Range) => {
    const url = new URL(basePath, "http://x");
    if (r === "30d") url.searchParams.delete("range");
    else url.searchParams.set("range", r);
    return `${url.pathname}${url.search}`;
  };

  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-[34px] font-bold tracking-tight">Sales</h1>
        <div className="text-right">
          <p className="text-[13px] text-muted">Last {range === "7d" ? "7" : "30"} days</p>
          <div className="mt-1.5 flex items-center justify-end gap-2">
            {(["7d", "30d"] as Range[]).map((r) => (
              <Link
                key={r}
                href={toggle(r)}
                scroll={false}
                className={cx(
                  "rounded-xl px-3 py-1.5 text-[15px] font-medium shadow-sm ring-1",
                  r === range
                    ? "bg-accent-soft text-accent ring-accent/20"
                    : "bg-white text-ink ring-line hover:bg-black/[0.02]",
                )}
              >
                {r}
              </Link>
            ))}
            <RefreshButton />
          </div>
        </div>
      </div>

      <nav className="mt-4 inline-flex rounded-xl bg-black/[0.05] p-1">
        {TABS.map((tab) =>
          tab.href ? (
            <Link
              key={tab.id}
              href={withRange(tab.href, range)}
              className={cx(
                "rounded-[9px] px-4 py-1.5 text-[15px] transition-colors",
                tab.id === active
                  ? "bg-white font-semibold text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          ) : (
            <span
              key={tab.id}
              title="Pipeline isn't part of this build"
              className="cursor-default rounded-[9px] px-4 py-1.5 text-[15px] text-faint"
            >
              {tab.label}
            </span>
          ),
        )}
      </nav>
      <AsOf iso={new Date().toISOString()} />
    </header>
  );
}
