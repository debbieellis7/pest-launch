"use client";

import { useRouter } from "next/navigation";
import { cx } from "./ui";

/** The "Rep" chip in Call history: a chip-styled picker that filters by rep. */
export function RepFilter({
  reps,
  value,
  hrefFor,
}: {
  reps: string[];
  value: string | null;
  /** URL for each choice ("" = everyone), built on the server so other filters are kept. */
  hrefFor: Record<string, string>;
}) {
  const router = useRouter();
  return (
    <label
      className={cx(
        "relative inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1 text-[14px] font-medium shadow-[0_1px_1px_rgba(0,0,0,0.03)] ring-1",
        value
          ? "bg-accent-soft font-medium text-accent ring-accent/25"
          : "bg-white text-ink ring-line hover:bg-black/[0.03]",
      )}
    >
      {value ? `Rep: ${value}` : "Rep"}
      <svg
        viewBox="0 0 24 24"
        className="size-3.5 opacity-60"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
      <select
        aria-label="Filter by rep"
        value={value ?? ""}
        onChange={(e) => router.push(hrefFor[e.target.value], { scroll: false })}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="">Everyone</option>
        {reps.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </label>
  );
}
