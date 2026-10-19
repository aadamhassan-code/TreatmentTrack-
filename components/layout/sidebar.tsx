"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  LayoutDashboard,
  Plus,
  Upload,
  Stethoscope,
  BarChart3,
  Settings,
  Users,
  RefreshCw,
  Menu,
  X,
  SquareKanban,
  Contact,
  UserRound,
  LifeBuoy,
} from "lucide-react";
import { switchPractice } from "@/lib/actions/team";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { TourReplayButton } from "@/components/tour/guided-tour";

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 22 22" aria-hidden>
      <rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="5" y="5" width="4" height="12" rx="1.5" fill="currentColor" />
      <rect x="11" y="5" width="4" height="7" rx="1.5" fill="currentColor" />
    </svg>
  );
}

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  ownerOnly?: boolean;
  /** Hidden from dentist logins (practice-wide views). */
  notDentist?: boolean;
  dentally?: boolean;
};

const groups: { label: string | null; links: NavLink[] }[] = [
  {
    label: null,
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/patients", label: "Patients", icon: Contact },
      { href: "/cases", label: "Cases", icon: SquareKanban },
    ],
  },
  {
    label: "Insights",
    links: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/dentists", label: "Dentists", icon: UserRound, notDentist: true },
    ],
  },
  {
    label: "Bring quotes in",
    links: [
      { href: "/treatments/import", label: "Import spreadsheet", icon: Upload },
      { href: "/treatments/dentally", label: "From Dentally", icon: RefreshCw, dentally: true },
      { href: "/visits/new", label: "Log a visit", icon: Stethoscope },
    ],
  },
];

const footerLinks: NavLink[] = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/team", label: "Team & locations", icon: Users, ownerOnly: true },
  { href: "/help", label: "Help & support", icon: LifeBuoy },
];

const ROLE_LABEL = { owner: "Owner", staff: "Staff", dentist: "Dentist" } as const;

export function Sidebar({
  practiceId,
  practiceName,
  practices,
  role,
  dentallyPending,
}: {
  practiceId: string;
  practiceName: string;
  practices: { id: string; name: string }[];
  role: "owner" | "staff" | "dentist";
  /** null when Dentally isn't connected (the link is hidden). */
  dentallyPending: number | null;
}) {
  const pathname = usePathname();
  const [switching, startTransition] = useTransition();
  // Phone-sized screens: the sidebar becomes a slide-out menu.
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleFor = (l: NavLink) =>
    (!l.ownerOnly || role === "owner") &&
    (!l.notDentist || role !== "dentist") &&
    (!l.dentally || dentallyPending !== null);

  const renderLink = ({ href, label: baseLabel, icon: Icon, dentally }: NavLink) => {
    const label =
      role === "dentist" && href === "/dashboard"
        ? "My quotes"
        : role === "dentist" && href === "/reports"
          ? "My reports"
          : role === "dentist" && href === "/cases"
            ? "My cases"
            : baseLabel;
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        key={href}
        href={href}
        data-tour={`nav-${href}`}
        aria-current={active ? "page" : undefined}
        onClick={() => setMenuOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active ? "bg-cream-0 text-teal-900 shadow-sm shadow-ink-900/5 ring-1 ring-ink-900/5" : "text-ink-700 hover:bg-teal-100/60 hover:text-ink-900",
        )}
      >
        <Icon className={cn("h-4 w-4", active ? "text-teal-700" : "text-ink-500")} aria-hidden />
        {label}
        {dentally && !!dentallyPending && (
          <span className="ml-auto rounded-full bg-butter px-2 py-0.5 text-[11px] font-semibold text-ink-900">
            {dentallyPending}
          </span>
        )}
      </Link>
    );
  };

  const content = (
    <>
      <div className="px-6 py-6">
        <p className="flex items-center gap-2 text-[15px] font-bold tracking-tight"><LogoMark />TreatmentTrack</p>
        {practices.length > 1 ? (
          <select
            value={practiceId}
            disabled={switching}
            onChange={(e) => {
              const id = e.target.value;
              startTransition(() => switchPractice(id));
            }}
            aria-label="Switch practice"
            className="mt-2 w-full rounded-md border border-teal-100 bg-white px-2 py-1.5 text-xs text-ink-900"
          >
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-0.5 truncate text-xs text-ink-500">
            {practiceName}
          </p>
        )}
        <p className="mt-1 text-xs text-ink-500">Signed in as {ROLE_LABEL[role].toLowerCase()}</p>
        <Link
          href="/treatments/new"
          data-tour="nav-/treatments/new"
          onClick={() => setMenuOpen(false)}
          className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-teal-900 px-3 py-2.5 text-sm font-medium text-cream-50 hover:bg-teal-800"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add a quote
        </Link>
      </div>
      <nav className="flex-1 space-y-5 px-3" aria-label="Main">
        {groups.map((group) => {
          const visible = group.links.filter(visibleFor);
          if (visible.length === 0) return null;
          return (
            <div key={group.label ?? "main"} className="space-y-0.5">
              {group.label && <p className="px-3 pb-1 text-xs font-medium text-ink-500">{group.label}</p>}
              {visible.map(renderLink)}
            </div>
          );
        })}
      </nav>
      <div className="space-y-0.5 border-t border-teal-100 px-3 py-4">
        {footerLinks.filter(visibleFor).map(renderLink)}
        <TourReplayButton onClick={() => setMenuOpen(false)} />
        <SignOutButton />
      </div>
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-teal-100 bg-teal-50 px-4 py-3 text-ink-900 md:hidden">
        <div className="min-w-0">
          <p className="text-[15px] font-bold tracking-tight">TreatmentTrack</p>
          <p className="truncate text-xs text-ink-500">{practiceName}</p>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-2 hover:bg-teal-100"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setMenuOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col overflow-y-auto bg-teal-50 text-ink-900">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-5 rounded-md p-2 hover:bg-teal-100"
            >
              <X className="h-5 w-5" />
            </button>
            {content}
          </aside>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 flex-col border-r border-teal-100 bg-teal-50 text-ink-900 md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto">{content}</aside>
    </>
  );
}
