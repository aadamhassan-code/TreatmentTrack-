import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — TreatmentTrack",
  description: "The terms on which dental practices use TreatmentTrack.",
};

const UPDATED = "18 October 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl text-ink-900">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-700">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl text-ink-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-ink-500">Last updated {UPDATED}</p>

      <Section title="What TreatmentTrack is">
        <p>
          TreatmentTrack is software for dental practices: it records quoted treatment, sends
          consent-gated follow-up messages in the practice&rsquo;s name, and tracks booked treatment
          through to completion. These terms are an agreement between TreatmentTrack and the practice
          (or practitioner) holding the account. By creating an account you agree to them on your
          practice&rsquo;s behalf.
        </p>
      </Section>

      <Section title="Accounts and billing">
        <p>
          Self-serve plans are billed by card through Stripe, monthly or annually, at the prices
          shown on the pricing page. An account only becomes active once payment succeeds. You can
          cancel at any time; the account stays active to the end of the paid period and no further
          payments are taken. Larger groups are provisioned under a separate written agreement.
        </p>
      </Section>

      <Section title="Your responsibilities">
        <p>
          Messages are sent in your practice&rsquo;s name, so they are your practice&rsquo;s
          communications. You are responsible for: only starting follow-up where your patient was
          offered an opt-out when the quote was discussed (the PECR soft opt-in the product asks you
          to confirm); the accuracy of patient details and quotes you enter or import; and ensuring
          the wording of your templates meets the professional standards that apply to you,
          including GDC guidance on patient communications. The templates provided are a compliant
          starting point, not legal advice.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          The service may only be used to contact patients about their own treatment at your
          practice. It must not be used to message people who have opted out (the product enforces
          this), to send content unrelated to dental care, or to process data you have no right to
          process.
        </p>
      </Section>

      <Section title="Data protection">
        <p>
          Your practice is the data controller for patient data; TreatmentTrack processes it on your
          instructions as a processor, on the terms in the{" "}
          <Link href="/dpa" className="text-teal-700 underline">
            Data Processing Agreement
          </Link>
          , which forms part of these terms. Our own handling of practice account data is described
          in the{" "}
          <Link href="/privacy" className="text-teal-700 underline">
            privacy notice
          </Link>
          .
        </p>
      </Section>

      <Section title="Availability and support">
        <p>
          We aim to keep the service available at all times but do not guarantee uninterrupted
          availability on self-serve plans. Scheduled messages that cannot be sent are held and
          retried rather than silently dropped, and their status is visible in the app. Support is
          available through the contact options on our site.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          Nothing in these terms excludes liability that cannot be excluded by law. Otherwise,
          TreatmentTrack&rsquo;s total liability in any 12-month period is limited to the fees your
          practice paid for the service in that period, and neither party is liable for indirect or
          consequential loss.
        </p>
      </Section>

      <Section title="Ending the agreement">
        <p>
          You may close your account at any time. We may suspend or end an account that breaks these
          terms or whose payment fails and is not remedied. On closure, patient data is handled as
          set out in the Data Processing Agreement: exported on request, then deleted.
        </p>
      </Section>

      <Section title="Governing law">
        <p>These terms are governed by the law of England and Wales, and its courts have exclusive jurisdiction.</p>
      </Section>
    </main>
  );
}
