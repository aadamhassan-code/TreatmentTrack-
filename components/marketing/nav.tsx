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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium text-ink-700 md:flex">
          <Link href="/#how-it-works" className="hover:text-ink-900">
            How it works
          </Link>
          <Link href="/#compliance" className="hover:text-ink-900">
            Compliance
          </Link>
          <Link href="/#security" className="hover:text-ink-900">
            Security
          </Link>
          <Link href="/#questions" className="hover:text-ink-900">
            Questions
          </Link>
          <Link href="/pricing" className="hover:text-ink-900">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <LinkButton href="/login" variant="ghost" size="sm">
            Log in
          </LinkButton>
          <LinkButton href="/signup" variant="primary" size="sm">
            Try it free
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
