"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/** Re-fetches the page's data (the "Refresh" button in PestLaunch's headers). */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => router.refresh())}
      disabled={pending}
      className="rounded-xl bg-white px-3.5 py-1.5 text-[15px] font-medium text-ink shadow-sm ring-1 ring-line hover:bg-black/[0.02] disabled:opacity-60"
    >
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}

/** "Calls as of Oct 20, 3:12 AM PST", shown in the viewer's own time zone. */
export function AsOf({ iso }: { iso: string }) {
  // Formatted after mount so it uses the viewer's time zone, not the server's.
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    setLabel(
      new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }),
    );
  }, [iso]);
  return <p className="mt-3 h-5 text-[13px] text-faint">{label && `Calls as of ${label}`}</p>;
}
