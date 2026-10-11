import { LinkButton } from "@/components/ui/button";
import { LedgerPreview } from "@/components/marketing/ledger-preview";
import { BUILT_BY } from "@/components/marketing/built-by";

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
      <div className="grid items-center gap-16 md:grid-cols-2">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-teal-900/15 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-800">
            Built for Dentally &amp; SOE practices
          </p>
          <h1 className="mt-6 font-display text-4xl font-medium leading-[1.1] text-ink-900 md:text-5xl">
            You already quoted the treatment.
            <br />
            <span className="text-teal-800">Someone still has to ask again.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-700">
            TreatmentTrack logs every implant, crown, ortho and whitening
            quote a patient hasn&rsquo;t accepted, then follows up by SMS,
            WhatsApp and email — on a schedule you choose, with the opt-out and
            consent handling PECR requires — until they book or say stop.
          </p>
          <p className="mt-3 max-w-lg text-sm text-ink-500">
            This isn&rsquo;t a recall reminder tool. It doesn&rsquo;t nudge
            patients about a six-month check-up — it chases the specific,
            quoted revenue your practice already diagnosed and hasn&rsquo;t
            collected.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <LinkButton href="/signup" size="lg">
              Start recovering revenue
            </LinkButton>
            <LinkButton href="/request-callback?topic=walkthrough" variant="secondary" size="lg">
              Talk to us first
            </LinkButton>
          </div>
          <p className="mt-4 text-sm text-ink-500">
            From £99/mo. Checkout takes three minutes — or we&rsquo;ll walk you through it first.
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-700">
            {[BUILT_BY, "Data held in the UK", "Opt-out on every message"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <LedgerPreview />
      </div>
    </section>
  );
}
