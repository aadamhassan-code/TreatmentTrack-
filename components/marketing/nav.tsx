import Link from "next/link";
import { LinkButton } from "@/components/ui/button";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 text-[17px] font-bold tracking-tight text-teal-900 ${className ?? ""}`}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="5" y="5" width="4" height="12" rx="1.5" fill="currentColor" />
        <rect x="11" y="5" width="4" height="7" rx="1.5" fill="currentColor" />
      </svg>
      TreatmentTrack
    </Link>
  );
}

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-900/5 bg-cream-50/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:gap-6 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium text-ink-700 md:flex">
          <Link href="/#how-it-works" className="hover:text-ink-900">
            How it works
          </Link>
          <Link href="/#revenue" className="hover:text-ink-900">
            Revenue
          </Link>
          <Link href="/#cases" className="hover:text-ink-900">
            Case tracking
          </Link>
          <Link href="/pricing" className="hover:text-ink-900">
            Pricing
          </Link>
          <Link href="/security" className="hover:text-ink-900">
            Data &amp; security
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <LinkButton href="/login" variant="ghost" size="sm" className="whitespace-nowrap">
            Log in
          </LinkButton>
          <LinkButton href="/signup" variant="primary" size="sm" className="whitespace-nowrap">
            Get started
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
