import Link from "next/link";
import { LinkButton } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-900/8 bg-cream-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-xl font-medium text-teal-900">
          TreatmentTrack
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-700 md:flex">
          <Link href="/#how-it-works" className="hover:text-teal-900">
            How it works
          </Link>
          <Link href="/#compliance" className="hover:text-teal-900">
            Compliance
          </Link>
          <Link href="/pricing" className="hover:text-teal-900">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <LinkButton href="/login" variant="ghost" size="sm">
            Log in
          </LinkButton>
          <LinkButton href="/signup" variant="primary" size="sm">
            Start recovering revenue
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
