/**
 * The money: what's open, what follow-up booked, and what converts by
 * treatment and by dentist — mirroring the in-app Reports page.
 */

const PIPELINE = [
  { label: "Booked", pence: 1_265_000, bar: "bg-teal-600", dot: "bg-teal-600" },
  { label: "Still in follow-up", pence: 4_820_000, bar: "bg-gold-300", dot: "bg-gold-300" },
  { label: "Declined", pence: 310_000, bar: "bg-clay-500", dot: "bg-clay-500" },
  { label: "Lost", pence: 590_000, bar: "bg-ink-300", dot: "bg-ink-300" },
];

const BY_TREATMENT = [
  { name: "Implants", booked: "£7,350", rate: 35 },
  { name: "Invisalign", booked: "£3,200", rate: 25 },
  { name: "Veneers and bonding", booked: "£1,700", rate: 22 },
  { name: "Whitening", booked: "£400", rate: 41 },
];

const BY_DENTIST = [
  { name: "Dr Khan", booked: "£5,900", rate: 38 },
  { name: "Dr Hassan", booked: "£4,350", rate: 29 },
  { name: "Dr Morgan", booked: "£2,400", rate: 21 },
];

const gbp = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pence / 100);

function RateTable({ title, rows }: { title: string; rows: { name: string; booked: string; rate: number }[] }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-ink-500">{title}</p>
      <table className="mt-2 w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th>Name</th>
            <th>Booked</th>
            <th>Conversion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-ink-900/5">
              <td className="py-2 pr-3 text-ink-900">{r.name}</td>
              <td className="py-2 pr-3 text-right font-mono text-ink-700">{r.booked}</td>
              <td className="w-24 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-cream-100">
                    <div className="h-1.5 rounded-full bg-teal-600" style={{ width: `${r.rate}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono text-[12px] text-ink-500">{r.rate}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RevenueLedger() {
  const total = PIPELINE.reduce((a, p) => a + p.pence, 0);
  return (
    <section id="revenue" className="scroll-mt-20 border-y border-ink-900/5 bg-cream-100 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl leading-tight text-ink-900 md:text-[40px]">
            Every quoted pound, accounted for.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-500">
            See how much treatment is still open, how much follow-up has booked, and which treatments and dentists
            convert best. This month, this quarter, or since you started.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-ink-900/8 bg-cream-0 p-6 shadow-xl shadow-ink-900/[0.06] md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium text-ink-900">Quoted this quarter</p>
            <p className="font-mono text-2xl font-medium text-ink-900">{gbp(total)}</p>
          </div>

          <div className="mt-4 flex h-4 overflow-hidden rounded-full" aria-hidden>
            {PIPELINE.map((p) => (
              <div key={p.label} className={p.bar} style={{ width: `${(p.pence / total) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {PIPELINE.map((p) => (
              <li key={p.label}>
                <p className="flex items-center gap-2 text-[13px] text-ink-500">
                  <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${p.dot}`} />
                  {p.label}
                </p>
                <p className="mt-0.5 font-mono text-lg text-ink-900">{gbp(p.pence)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8 grid gap-8 border-t border-ink-900/8 pt-6 md:grid-cols-2">
            <RateTable title="Booked by treatment" rows={BY_TREATMENT} />
            <RateTable title="Booked by dentist" rows={BY_DENTIST} />
          </div>
        </div>
        <p className="mt-4 text-center text-[13px] text-ink-300">Example figures for illustration.</p>
      </div>
    </section>
  );
}
