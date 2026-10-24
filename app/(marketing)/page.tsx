import { Hero } from "@/components/marketing/hero";
import { DailyChase } from "@/components/marketing/daily-chase";
import { RevenueLedger } from "@/components/marketing/revenue-ledger";
import { BoardDemo } from "@/components/marketing/board-demo";
import { ComplianceStrip } from "@/components/marketing/compliance-strip";
import { PricingTable } from "@/components/marketing/pricing-table";
import { Faq } from "@/components/marketing/faq";
import { LinkButton } from "@/components/ui/button";
import { PRIMARY_CTA } from "@/lib/launch";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <DailyChase />
      <RevenueLedger />

      <section id="cases" className="scroll-mt-20 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl leading-tight text-ink-900 md:text-[40px]">
              When they say yes, follow the case to the final fit.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-500">
              Booked treatment moves onto a board with your own stages, from consultation to completion. Anyone
              sitting at a stage longer than usual is flagged, so no case quietly stalls.
            </p>
          </div>
          <div className="mt-12">
            <BoardDemo />
          </div>
        </div>
      </section>

      <ComplianceStrip />

      <section id="pricing" className="scroll-mt-20 px-6 py-20 md:py-24">
        <h2 className="mx-auto max-w-2xl text-center font-display text-3xl leading-tight text-ink-900 md:text-[40px]">
          A flat monthly price, whatever you recover.
        </h2>
        <div className="mx-auto mt-12 max-w-6xl">
          <PricingTable />
        </div>
      </section>

      <Faq />

      <section className="bg-teal-900 text-cream-50">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center md:py-24">
          <h2 className="font-display text-3xl leading-tight md:text-[44px]">
            The quotes are already written. Let them get followed up.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-teal-100">
            Setting up takes an afternoon, and a single booked case can cover months of TreatmentTrack.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <LinkButton href={PRIMARY_CTA.href} variant="gilt" size="lg">
              {PRIMARY_CTA.label}
            </LinkButton>
            <LinkButton href="/request-callback?topic=walkthrough" variant="onDark" size="lg">
              Book a walkthrough
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
