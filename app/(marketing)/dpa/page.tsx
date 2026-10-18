import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Processing Agreement — TreatmentTrack",
  description:
    "How TreatmentTrack processes patient data on behalf of dental practices under UK GDPR.",
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

export default function DpaPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl text-ink-900">Data Processing Agreement</h1>
      <p className="mt-2 text-sm text-ink-500">
        Last updated {UPDATED} · Forms part of the Terms of Service
      </p>

      <Section title="Roles">
        <p>
          For patient data, the practice is the data controller and TreatmentTrack is the data
          processor under UK GDPR. We process patient data only to provide the service and only on
          the practice&rsquo;s documented instructions — using the product is the instruction.
        </p>
      </Section>

      <Section title="What is processed, and about whom">
        <p>
          Data subjects: the practice&rsquo;s patients. Categories: name, mobile number and email
          address; the treatment quoted and its price; consent and opt-out records; follow-up
          messages sent and replies received; and treatment plans shared from the practice&rsquo;s
          own practice management system where connected. No clinical notes, imaging or medical
          history are processed. Processing lasts for the duration of the practice&rsquo;s account.
        </p>
      </Section>

      <Section title="Security measures">
        <p>
          Every practice&rsquo;s data is isolated by database row-level security; consent records are
          append-only so history cannot be rewritten; practice management system credentials are
          encrypted (AES-256-GCM) before storage and are unreadable to signed-in users; all traffic
          is encrypted in transit; the database and application run in UK (London) regions; staff
          can protect their sign-in with two-factor authentication; and erasures and data exports
          are written to an audit log the practice owner can see.
          Access within TreatmentTrack is limited to what is needed to operate and support the
          service.
        </p>
      </Section>

      <Section title="Sub-processors">
        <p>We use the following sub-processors, each for a specific purpose:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase — database and authentication hosting (London, UK)</li>
          <li>Vercel — application hosting (served from London)</li>
          <li>Twilio — SMS and WhatsApp message delivery (USA; UK Extension to the EU-US Data Privacy Framework)</li>
          <li>Resend — email message delivery (USA; UK Extension to the EU-US Data Privacy Framework)</li>
          <li>Stripe — practice billing only; no patient data</li>
        </ul>
        <p>
          We will give practices notice before adding or changing a sub-processor that handles
          patient data.
        </p>
      </Section>

      <Section title="Assistance and rights">
        <p>
          We assist the practice in meeting data subject rights: patient records, consent history and
          message logs are visible and exportable in the product, and patient opt-outs are enforced
          automatically and immediately. We notify the practice without undue delay on becoming aware
          of a personal data breach affecting its data, and provide the information needed for the
          practice&rsquo;s own records and any ICO report.
        </p>
      </Section>

      <Section title="Confidentiality, audit and deletion">
        <p>
          Everyone with access to patient data is bound by confidentiality. We make available the
          information reasonably necessary to demonstrate compliance with this agreement. When an
          account closes, we return patient data on request and then delete it, except where law
          requires retention.
        </p>
      </Section>
    </main>
  );
}
