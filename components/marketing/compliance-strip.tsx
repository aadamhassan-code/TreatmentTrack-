import Link from "next/link";

const FACTS = [
  {
    title: "Consent on every quote",
    body: "Your team confirms the patient was offered an opt-out before any follow-up starts. The record can be added to, never edited.",
  },
  {
    title: "STOP means stop",
    body: "Every message says how to opt out. One STOP reply cancels everything still waiting to go to that patient.",
  },
  {
    title: "Held in the UK",
    body: "Patient data is stored and processed in London. No clinical notes, X-rays or medical history, ever.",
  },
];

/** A short, plain summary on the homepage; the detail lives on /security. */
export function ComplianceStrip() {
  return (
    <section id="compliance" className="scroll-mt-20 py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-6 py-10 md:px-10">
          <h2 className="text-center font-display text-2xl text-ink-900 md:text-3xl">
            Built for PECR and UK GDPR from the database up.
          </h2>
          <dl className="mx-auto mt-8 grid max-w-5xl gap-8 md:grid-cols-3">
            {FACTS.map((f) => (
              <div key={f.title} className="text-center md:text-left">
                <dt className="font-semibold text-teal-900">{f.title}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-ink-700">{f.body}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-center">
            <Link href="/security" className="font-medium text-teal-800 underline underline-offset-4 hover:text-teal-950">
              Read how TreatmentTrack handles patient data
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
