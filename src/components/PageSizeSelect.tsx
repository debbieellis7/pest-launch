"use client";

import { useRouter } from "next/navigation";
import { PAGE_SIZES } from "@/lib/pagination";

/** "Show 10 per page" picker under the Call history table. */
export function PageSizeSelect({
  value,
  hrefFor,
}: {
  value: number;
  /** URL for each size, built on the server so filters are kept (and the page resets to 1). */
  hrefFor: Record<string, string>;
}) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      Show
      <select
        value={value}
        onChange={(e) => router.push(hrefFor[e.target.value], { scroll: false })}
        className="cursor-pointer rounded-lg bg-white px-2 py-1 text-sm font-medium text-ink shadow-[0_1px_1px_rgba(0,0,0,0.03)] ring-1 ring-line hover:bg-black/[0.03]"
      >
        {PAGE_SIZES.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      per page
    </label>
  );
}
