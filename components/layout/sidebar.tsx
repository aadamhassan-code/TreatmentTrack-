"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  LayoutDashboard,
  FilePlus2,
  Upload,
  Stethoscope,
  BarChart3,
  Settings,
  Users,
  RefreshCw,
} from "lucide-react";
import { switchPractice } from "@/lib/actions/team";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/layout/sign-out-button";

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  ownerOnly?: boolean;
  dentally?: boolean;
};

const links: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/treatments/new", label: "Add treatment", icon: FilePlus2 },
  { href: "/treatments/import", label: "Import CSV", icon: Upload },
  {
    href: "/treatments/dentally",
    label: "From Dentally",
    icon: RefreshCw,
    dentally: true,
  },
  { href: "/visits/new", label: "Log visit", icon: Stethoscope },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/team", label: "Team & locations", icon: Users, ownerOnly: true },
];

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
  role: "owner" | "staff";
  /** null when Dentally isn't connected (the link is hidden). */
  dentallyPending: number | null;
}) {
  const pathname = usePathname();
  const [switching, startTransition] = useTransition();

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-teal-950 text-cream-50">
      <div className="px-6 py-6">
        <p className="font-display text-lg font-medium">TreatmentTrack</p>
        {practices.length > 1 ? (
          <select
            value={practiceId}
            disabled={switching}
            onChange={(e) => {
              const id = e.target.value;
              startTransition(() => switchPractice(id));
            }}
            aria-label="Switch practice"
            className="mt-2 w-full rounded-md border border-cream-50/15 bg-teal-900 px-2 py-1.5 text-xs text-cream-50"
          >
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-0.5 truncate text-xs text-teal-300">
            {practiceName}
          </p>
        )}
        <p className="mt-1 text-[11px] uppercase tracking-wide text-teal-400">
          {role}
        </p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {links
          .filter(
            (l) =>
              (!l.ownerOnly || role === "owner") &&
              (!l.dentally || dentallyPending !== null),
          )
          .map(({ href, label, icon: Icon, dentally }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-cream-50/10 text-cream-50"
                    : "text-teal-200 hover:bg-cream-50/5 hover:text-cream-50",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {dentally && !!dentallyPending && (
                  <span className="ml-auto rounded-full bg-gold-500 px-2 py-0.5 text-[11px] font-semibold text-teal-950">
                    {dentallyPending}
                  </span>
                )}
              </Link>
            );
          })}
      </nav>
      <div className="border-t border-cream-50/10 px-3 py-4">
        <SignOutButton />
      </div>
    </aside>
  );
}
