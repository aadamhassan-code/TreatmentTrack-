import type { Metadata } from "next";
import { PricingTable } from "@/components/marketing/pricing-table";

export const metadata: Metadata = {
  title: "Pricing — TreatmentTrack",
};

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
          Pricing
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium text-ink-900">
          Priced for what it recovers, not per patient record.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-500">
          Every plan includes the full consent model and audit trail — that
          isn&rsquo;t a top-tier-only feature. Higher tiers add WhatsApp,
          unlimited volume, and the cross-sell suggestion engine. Running
          more than 5 practices? We&rsquo;ll price it with you directly.
        </p>
      </div>
      <div className="mt-12">
        <PricingTable />
      </div>

      <div className="mx-auto mt-20 max-w-2xl">
        <h2 className="font-display text-2xl font-medium text-ink-900">
          Questions practices actually ask
        </h2>
        <dl className="mt-6 space-y-6">
          <div>
            <dt className="font-medium text-ink-900">
              Do you charge per SMS or WhatsApp message?
            </dt>
            <dd className="mt-1 text-sm text-ink-500">
              No — the subscription covers the sequence engine. You connect
              your own Twilio account, so message costs run at Twilio&rsquo;s
              rates, billed to you directly.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink-900">
              What happens if we cancel?
            </dt>
            <dd className="mt-1 text-sm text-ink-500">
              Sequences stop sending and your data stays exportable. We don&rsquo;t
              hold your patient records hostage.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink-900">
              Is this a replacement for Dentally, SOE or CareStack?
            </dt>
            <dd className="mt-1 text-sm text-ink-500">
              No — it sits alongside your practice management software and
              handles one job neither is built for: chasing a specific
              declined quote until it&rsquo;s resolved.
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
