const pillars = [
  {
    title: "Two consents, never merged",
    body: "Offering an opt-out on a specific declined quote (PECR's soft opt-in) is legally separate from consent to be contacted about other treatment based on dental history. TreatmentTrack captures and stores them as two distinct, timestamped records — never one standing in for the other.",
  },
  {
    title: "A cross-sell block that can't be switched off by accident",
    body: "If category-(b) consent isn't on file for a patient, TreatmentTrack refuses to generate a cross-sell suggestion from a hygiene or extraction visit — full stop, regardless of your practice-wide settings.",
  },
  {
    title: "Consent you can actually produce later",
    body: "Every capture is stored with who recorded it and exactly when, and it's never overwritten — only ever added to. If you're asked to show your consent trail, you can.",
  },
  {
    title: "Opt-out on every message, enforced immediately",
    body: "Every SMS, WhatsApp and email carries a clear way to stop. The moment a patient does, their sequence halts before the next scheduled send — not at the end of the day, not after a review.",
  },
];

const comparisonRows = [
  {
    feature: "What it follows up on",
    generic: "General recall — check-ups, hygiene visits",
    treatmenttrack: "A specific quoted treatment the patient declined",
  },
  {
    feature: "Consent model",
    generic: "One blanket “marketing communications” toggle",
    treatmenttrack: "Two separate, timestamped consents per PECR",
  },
  {
    feature: "Cross-sell suggestions",
    generic: "Not distinguished from recall messaging",
    treatmenttrack: "Hard-blocked without individual patient consent",
  },
  {
    feature: "Built around",
    generic: "Whatever the PMS ships as a bolt-on",
    treatmenttrack: "Dentally / SOE workflows, UK PECR and GDPR",
  },
];

export function ComplianceTrust() {
  return (
    <section id="compliance" className="scroll-mt-20 bg-teal-950 py-20 text-cream-50">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-300">
            Compliance, not an afterthought
          </p>
          <h2 className="mt-3 font-display text-3xl font-medium md:text-4xl">
            Dentally and SOE both ship &ldquo;automated patient
            communications.&rdquo; This isn&rsquo;t that.
          </h2>
          <p className="mt-4 text-teal-200">
            Generic recall tools weren&rsquo;t built to separate a one-off
            follow-up on a declined quote from ongoing marketing consent. UK
            data protection law treats those as different things. So do we.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {pillars.map((p) => (
            <div key={p.title} className="rounded-xl border border-cream-50/10 p-6">
              <h3 className="font-display text-lg font-medium text-cream-50">
                {p.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-teal-200">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-14 overflow-x-auto rounded-xl border border-cream-50/10">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-cream-50/10 text-xs uppercase tracking-wide text-teal-300">
                <th className="px-5 py-4 font-medium">&nbsp;</th>
                <th className="px-5 py-4 font-medium">Generic recall tools</th>
                <th className="px-5 py-4 font-medium text-gold-300">
                  TreatmentTrack
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="border-b border-cream-50/10 last:border-0">
                  <td className="px-5 py-4 font-medium text-cream-50">
                    {row.feature}
                  </td>
                  <td className="px-5 py-4 text-teal-300">{row.generic}</td>
                  <td className="px-5 py-4 text-cream-50">
                    {row.treatmenttrack}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
