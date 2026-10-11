import { Hero } from "@/components/marketing/hero";
import { ProblemSolution } from "@/components/marketing/problem-solution";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ComplianceTrust } from "@/components/marketing/compliance-trust";
import { PricingTable } from "@/components/marketing/pricing-table";
import { BuiltBy } from "@/components/marketing/built-by";
import { Security } from "@/components/marketing/security";
import { Faq } from "@/components/marketing/faq";
import { LinkButton } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProblemSolution />
      <HowItWorks />
      <BuiltBy />
      <ComplianceTrust />
      <Security />

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
            Pricing
          </p>
          <h2 className="mt-3 font-display text-3xl font-medium text-ink-900 md:text-4xl">
            From a single dentist to a five-site group — priced to match.
          </h2>
        </div>
        <div className="mt-12">
          <PricingTable />
        </div>
      </section>

      <Faq />

      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="font-display text-3xl font-medium text-ink-900 md:text-4xl">
          Stop letting quoted treatment expire quietly.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-ink-500">
          Set up takes an afternoon. The first recovered case usually pays
          for the month.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/signup" size="lg">
            Start recovering revenue
          </LinkButton>
          <LinkButton href="/request-callback?topic=walkthrough" variant="secondary" size="lg">
            Talk to us first
          </LinkButton>
        </div>
      </section>
    </>
  );
}
