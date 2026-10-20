import Link from "next/link";
import {
  ArrowLeftRight,
  Bug,
  ChartColumn,
  CircleQuestionMark,
  LogOut,
  EyeOff,
  House,
  LayoutGrid,
  Lightbulb,
  List,
  MessageSquare,
  Search,
  Target,
  Users,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "./NavLink";
import { cx } from "./ui";

// The PestLaunch OS navigation, so Call Intelligence sits where it would in the product.
// Only Sales is live in this build; the rest mirror the real app for context.
type NavItem = {
  label: string;
  icon: LucideIcon;
  href?: string;
  /** Other paths that belong to this section (for the active highlight). */
  match?: string[];
  hidden?: boolean;
};

const MAIN: NavItem[] = [
  { label: "Home", icon: House },
  { label: "Tasks", icon: List },
  { label: "Team", icon: Users },
  { label: "Assistant", icon: Lightbulb },
  { label: "Financials", icon: ChartColumn },
  { label: "Collections", icon: Bug, hidden: true },
  { label: "Sales", icon: Target, href: "/sales/calls", match: ["/sales"] },
  { label: "Customer Health", icon: UsersRound },
  { label: "Updates", icon: Zap },
];

const BOTTOM: NavItem[] = [
  { label: "All clients", icon: LayoutGrid, hidden: true },
  { label: "Connections", icon: ArrowLeftRight },
  { label: "Feedback", icon: MessageSquare },
  { label: "Support", icon: CircleQuestionMark },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "grid size-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-b from-[#2f8cff] to-[#0062d6] font-bold text-white shadow-sm",
        className,
      )}
      aria-hidden
    >
      <span className="text-[1.05em] leading-none">P</span>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <div className="leading-tight">
        <p className="text-[15px] font-semibold">Call Intelligence</p>
        <p className="text-xs text-faint">Powered by PestLaunch</p>
      </div>
    </div>
  );
}

/** Looks like PestLaunch's ⌘K search; it's display-only in this build. */
function SearchBox() {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-[15px] text-faint shadow-[0_1px_1px_rgba(0,0,0,0.03)]"
      title="Search isn't part of this demo"
    >
      <Search className="size-4 shrink-0" strokeWidth={2} aria-hidden />
      <span className="flex-1">Search</span>
      <kbd className="rounded-md border border-line bg-[#fafafa] px-1.5 py-0.5 font-sans text-[11px] font-medium text-faint">
        ⌘K
      </kbd>
    </div>
  );
}

function NavRow({ item }: { item: NavItem }) {
  const Icon = item.icon;
  const content = (
    <>
      <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="flex-1">{item.label}</span>
      {item.hidden && (
        <EyeOff className="size-4 shrink-0 text-faint" strokeWidth={1.75} aria-label="Hidden" />
      )}
    </>
  );
  if (item.href) {
    return (
      <NavLink href={item.href} match={item.match}>
        {content}
      </NavLink>
    );
  }
  return (
    <span
      title="Not part of this demo"
      className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-[#3a3a3c]"
    >
      {content}
    </span>
  );
}

/** Compact top bar for phones, where the sidebar is hidden. */
export function MobileBar() {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-[#fbfbfd]/90 px-4 py-3 backdrop-blur lg:hidden">
      <Link href="/sales/calls" className="flex items-center gap-2.5">
        <BrandMark className="size-8 rounded-[9px]" />
        <span className="text-[15px] font-semibold">Call Intelligence</span>
      </Link>
      <form action="/api/logout" method="post">
        <button className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-black/[0.04]">
          <LogOut className="size-4" strokeWidth={1.75} aria-hidden />
          Log out
        </button>
      </form>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-[#fbfbfd] px-4 py-5 lg:flex">
      <div className="px-2">
        <Brand />
      </div>
      <div className="mt-5">
        <SearchBox />
      </div>

      <nav className="mt-5 space-y-0.5 border-t border-line pt-5">
        {MAIN.map((item) => (
          <NavRow key={item.label} item={item} />
        ))}
      </nav>

      <nav className="mt-auto space-y-0.5 border-t border-line pt-4">
        {BOTTOM.map((item) => (
          <NavRow key={item.label} item={item} />
        ))}
        <form action="/api/logout" method="post">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] text-[#3a3a3c] hover:bg-black/[0.04]">
            <LogOut className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
            Log out
          </button>
        </form>
      </nav>
    </aside>
  );
}
