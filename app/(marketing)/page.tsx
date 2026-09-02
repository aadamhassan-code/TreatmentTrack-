import { Hero } from "@/components/marketing/hero";
import { ProblemSolution } from "@/components/marketing/problem-solution";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ComplianceTrust } from "@/components/marketing/compliance-trust";
import { PricingTable } from "@/components/marketing/pricing-table";
import { LinkButton } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProblemSolution />
      <HowItWorks />
      <ComplianceTrust />

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
            Pricing
          </p>
          <h2 className="mt-3 font-display text-3xl font-medium text-ink-900 md:text-4xl">
            One plan for a single site. One for practices that also want
            cross-sell.
          </h2>
        </div>
        <div className="mt-12">
          <PricingTable />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24 text-center">
        <h2 className="font-display text-3xl font-medium text-ink-900 md:text-4xl">
          Stop letting quoted treatment expire quietly.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-ink-500">
          Set up takes an afternoon. The first recovered case usually pays
          for the month.
        </p>
        <div className="mt-8">
          <LinkButton href="/signup" size="lg">
            Start recovering revenue
          </LinkButton>
        </div>
      </section>
    </>
  );
}
