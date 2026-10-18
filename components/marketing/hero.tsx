import { LinkButton } from "@/components/ui/button";
import { FollowUpTrack } from "@/components/marketing/follow-up-track";

export function Hero() {
  return (
    <section className="bg-teal-900 text-cream-50">
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pb-24 md:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-balance font-display text-[40px] leading-[1.06] sm:text-[54px] md:text-[64px]">
            Turn &ldquo;I&rsquo;ll think about it&rdquo; <span className="whitespace-nowrap">into booked</span> treatment.
          </h1>
          <p className="mx-auto mt-6 max-w-[52ch] text-lg leading-relaxed text-teal-100 md:text-[19px]">
            TreatmentTrack follows up every treatment plan your practice quotes, with polite texts and emails in
            your name. It stops the moment the patient books or says no, and shows you exactly what it recovered.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <LinkButton href="/signup" variant="gilt" size="lg">
              Get started
            </LinkButton>
            <LinkButton href="/request-callback?topic=walkthrough" variant="onDark" size="lg">
              Book a walkthrough
            </LinkButton>
          </div>
          <p className="mt-6 text-sm text-teal-200">
            For UK practices on Dentally, SOE, R4 and CareStack. Patient data stays in the UK.
          </p>
        </div>

        <div className="mt-16 md:mt-20">
          <FollowUpTrack />
        </div>
      </div>
    </section>
  );
}
