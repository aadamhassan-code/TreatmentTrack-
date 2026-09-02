import { StatusBadge } from "@/components/ui/status-badge";

const rows = [
  { initials: "J.M.", treatment: "Single implant", value: "£2,400", status: "converted" as const },
  { initials: "R.K.", treatment: "Full ortho", value: "£3,100", status: "in_sequence" as const },
  { initials: "A.P.", treatment: "Porcelain crown", value: "£780", status: "in_sequence" as const },
  { initials: "S.T.", treatment: "Whitening", value: "£320", status: "future_intent" as const },
];

export function LedgerPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-3 -rotate-2 rounded-2xl border border-gold-300/60 bg-gold-100/40"
      />
      <div className="ledger-lines relative rounded-2xl border border-ink-900/10 bg-cream-0 p-6 shadow-xl shadow-teal-950/10">
        <div className="flex items-center justify-between">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
            September ledger — Riverside Dental
          </p>
          <span className="flex items-center gap-1.5 text-xs font-medium text-teal-700">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            Live
          </span>
        </div>

        <ul className="mt-5 space-y-3">
          {rows.map((row) => (
            <li
              key={row.initials}
              className="flex items-center justify-between border-b border-ink-900/6 pb-3 last:border-0"
            >
              <div>
                <p className="font-mono text-sm text-ink-900">{row.initials}</p>
                <p className="text-sm text-ink-500">{row.treatment}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm tabular-nums text-ink-900">
                  {row.value}
                </span>
                <StatusBadge status={row.status} />
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-end justify-between rounded-lg bg-teal-900 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-200">
              Recovered this month
            </p>
            <p className="text-xs text-teal-300/80">
              1 booked from a quote that had been sitting for 11 days
            </p>
          </div>
          <p className="font-mono text-2xl font-medium tabular-nums text-gold-300">
            £2,400
          </p>
        </div>
      </div>
    </div>
  );
}
