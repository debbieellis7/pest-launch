"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "./ui";

/** Sidebar link that highlights when the current page is one of its sections. */
export function NavLink({
  href,
  match,
  children,
}: {
  href: string;
  /** Path prefixes that count as "this section" (defaults to href). */
  match?: string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = (match ?? [href]).some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]",
        active ? "bg-accent-soft font-medium text-accent" : "text-[#3a3a3c] hover:bg-black/[0.04]",
      )}
    >
      {children}
    </Link>
  );
}
