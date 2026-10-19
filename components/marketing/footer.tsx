import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-ink-900/8 bg-cream-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="font-display text-lg text-teal-900">
              TreatmentTrack
            </p>
            <p className="mt-2 text-sm text-ink-500">
              Built in the UK for UK dental practices running Dentally, SOE or CareStack.
              Recovers quoted-but-declined treatment through PECR-compliant,
              consent-gated follow-up — not generic recall reminders.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div>
              <p className="font-semibold text-ink-900">Product</p>
              <ul className="mt-3 space-y-2 text-ink-500">
                <li>
                  <Link href="/#how-it-works" className="hover:text-teal-900">
                    How it works
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-teal-900">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/security" className="hover:text-teal-900">
                    Data &amp; security
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-ink-900">Account</p>
              <ul className="mt-3 space-y-2 text-ink-500">
                <li>
                  <Link href="/login" className="hover:text-teal-900">
                    Log in
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-teal-900">
                    Sign up
                  </Link>
                </li>
                <li>
                  <Link href="/request-callback" className="hover:text-teal-900">
                    Support
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-ink-900">Legal</p>
              <ul className="mt-3 space-y-2 text-ink-500">
                <li>
                  <Link href="/privacy" className="hover:text-teal-900">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-teal-900">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/dpa" className="hover:text-teal-900">
                    Data Processing Agreement
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-10 text-xs text-ink-300">
          © {new Date().getFullYear()} TreatmentTrack. Not a substitute for
          legal advice on PECR/GDPR compliance in your practice.
        </p>
      </div>
    </footer>
  );
}
