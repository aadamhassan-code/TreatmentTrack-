import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — TreatmentTrack",
  description: "How TreatmentTrack handles practice and patient data.",
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

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl text-ink-900">Privacy</h1>
      <p className="mt-2 text-sm text-ink-500">Last updated {UPDATED}</p>

      <Section title="The short version">
        <p>
          TreatmentTrack helps dental practices follow up treatment they have quoted. The practice
          you attend is responsible for your data (the data controller); TreatmentTrack processes it
          on the practice&rsquo;s instructions (the data processor). Patient data is stored in the UK,
          follow-up messages are only sent where the practice has recorded your permission, and every
          message tells you how to opt out. Reply STOP to any text and the messages stop.
        </p>
      </Section>

      <Section title="What we process for practices">
        <p>
          For each practice account: staff names, work email addresses, login records and billing
          details (card payments are handled by Stripe — we never see card numbers).
        </p>
      </Section>

      <Section title="What we process on behalf of practices">
        <p>
          On a practice&rsquo;s instructions we process: patient name, mobile number and email
          address; the treatment quoted and its price; the consent the practice recorded (when, by
          whom, and for what); the follow-up messages sent and any replies, including opt-outs; and,
          where the practice has connected its practice management system, the treatment plans it
          shares with us. We do not process clinical notes, X-rays or medical history.
        </p>
      </Section>

      <Section title="Consent and opt-out">
        <p>
          A follow-up sequence can only start once the practice has recorded that you were offered an
          opt-out when the quote was discussed, as PECR requires. Consent records are kept
          append-only so they can&rsquo;t be edited after the fact. Replying STOP (or UNSUBSCRIBE by
          email) withdraws consent immediately: you are marked opted out, the withdrawal is recorded,
          and all pending messages are cancelled. A practice can&rsquo;t re-enrol you without
          recording a fresh request from you.
        </p>
      </Section>

      <Section title="Where data lives">
        <p>
          The database is hosted with Supabase in London, and the application&rsquo;s server code
          runs in Vercel&rsquo;s London region, so patient data is stored and processed in the UK.
          Messages are delivered by sub-processors: Twilio (SMS and WhatsApp) and Resend (email),
          which handle the content of the messages they send.
        </p>
      </Section>

      <Section title="Retention and deletion">
        <p>
          Data is retained while the practice holds an account, because consent and opt-out history
          must stay provable. When a practice closes its account, or asks us to delete a patient
          record, the data is deleted. Patients should direct access or deletion requests to their
          practice, which controls the data; we support the practice in meeting them.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this notice or about your data: email the practice that holds your record,
          or contact us via the details on our site and we will pass your request to the practice and
          assist with it.
        </p>
      </Section>
    </main>
  );
}
