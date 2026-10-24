import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { PRIMARY_CTA } from "@/lib/launch";

export const metadata: Metadata = {
  title: "Data & security — TreatmentTrack",
  description:
    "How TreatmentTrack records consent, honours opt-outs, keeps each practice's data separate and holds patient data in the UK.",
};

const CONSENT = [
  {
    title: "Two kinds of permission, kept apart",
    body: "Following up a specific quote relies on PECR’s soft opt-in. Contacting a patient about other treatment based on their dental history needs separate consent. TreatmentTrack stores them as two distinct, timestamped records and never lets one stand in for the other.",
  },
  {
    title: "No follow-up without a consent record",
    body: "The database itself refuses to create a follow-up unless a granted opt-out record exists for that patient and that practice. It isn’t a box on a form that can be skipped.",
  },
  {
    title: "A history that can’t be rewritten",
    body: "Each consent record notes who captured it and when. Records can only be added to, never edited or deleted, so you can always show what was agreed.",
  },
  {
    title: "Opt-outs honoured at once",
    body: "A STOP reply marks the patient opted out, logs the withdrawal and cancels every pending message in one step. They can’t be put back into follow-up unless a fresh request from them is recorded.",
  },
  {
    title: "Other-treatment suggestions are hard-blocked",
    body: "If a patient hasn’t agreed to hear about other treatment, TreatmentTrack won’t suggest it after a hygiene or extraction visit, whatever the practice-wide setting says.",
  },
];

const COMPARISON = [
  { feature: "What it follows up", generic: "General recall: check-ups and hygiene", ours: "A specific treatment plan the patient was quoted" },
  { feature: "Consent", generic: "One blanket marketing toggle", ours: "Separate, timestamped records per PECR" },
  { feature: "Other-treatment suggestions", generic: "Mixed in with recall messages", ours: "Blocked without that patient’s consent" },
];

const PROTECTION = [
  {
    title: "Records stored in London",
    body: "The database is hosted by Supabase in London and the app runs from Vercel’s London region. Texts go via Twilio and emails via Resend, both US companies certified under the UK-US data bridge.",
  },
  {
    title: "Each practice walled off",
    body: "Every record belongs to one practice, and the database refuses to return another practice’s data on every request — not just in the screens.",
  },
  {
    title: "Each login sees only its own work",
    body: "Owners manage settings and the team, staff handle day-to-day follow-up, and dentists see only their own patients’ quotes and figures.",
  },
  {
    title: "Only what follow-up needs",
    body: "Name, mobile, optional email, the treatment quoted and its value. No dates of birth, medical history, clinical notes or radiographs.",
  },
  {
    title: "Practice software read, never written",
    body: "Connections to Dentally only read. The key your practice issues is encrypted before it’s stored and is never shown again in the app.",
  },
  {
    title: "No tracking of your team",
    body: "No advertising or analytics trackers in the app — only the cookie that keeps you signed in.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <section className="bg-teal-900 text-cream-50">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center md:py-20">
          <h1 className="font-display text-4xl leading-tight md:text-5xl">How TreatmentTrack handles patient data</h1>
          <p className="mx-auto mt-5 max-w-[56ch] text-lg leading-relaxed text-teal-100">
            Following up quoted treatment means messaging patients in your practice&rsquo;s name. These are the rules
            the product enforces so that every message is one you&rsquo;re entitled to send.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <h2 className="font-display text-2xl text-ink-900 md:text-3xl">Consent and opt-out</h2>
        <dl className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {CONSENT.map((c) => (
            <div key={c.title} className="border-t border-ink-900/10 pt-5">
              <dt className="font-semibold text-ink-900">{c.title}</dt>
              <dd className="mt-2 leading-relaxed text-ink-700">{c.body}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-14 overflow-x-auto rounded-xl border border-ink-900/8 bg-cream-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="px-5 pt-5 text-left font-semibold text-ink-900">
              How this differs from recall messaging in practice software
            </caption>
            <thead>
              <tr className="border-b border-ink-900/8 text-[13px] text-ink-500">
                <th className="px-5 py-3 font-medium">
                  <span className="sr-only">Feature</span>
                </th>
                <th className="px-5 py-3 font-medium">Typical recall tools</th>
                <th className="px-5 py-3 font-medium text-teal-800">TreatmentTrack</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((r) => (
                <tr key={r.feature} className="border-b border-ink-900/5 last:border-0">
                  <th scope="row" className="px-5 py-3.5 font-medium text-ink-900">
                    {r.feature}
                  </th>
                  <td className="px-5 py-3.5 text-ink-500">{r.generic}</td>
                  <td className="px-5 py-3.5 text-ink-900">{r.ours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-ink-900/5 bg-cream-100">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <h2 className="font-display text-2xl text-ink-900 md:text-3xl">Where data lives, and who can see it</h2>
          <dl className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {PROTECTION.map((p) => (
              <div key={p.title} className="border-t border-ink-900/10 pt-5">
                <dt className="font-semibold text-ink-900">{p.title}</dt>
                <dd className="mt-2 leading-relaxed text-ink-700">{p.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center md:py-20">
        <h2 className="font-display text-2xl text-ink-900 md:text-3xl">The documents</h2>
        <p className="mt-4 leading-relaxed text-ink-700">
          Your practice is the data controller and TreatmentTrack the processor. The full terms are published:{" "}
          <Link href="/privacy" className="font-medium text-teal-800 underline underline-offset-4">
            privacy notice
          </Link>
          ,{" "}
          <Link href="/terms" className="font-medium text-teal-800 underline underline-offset-4">
            terms of service
          </Link>{" "}
          and{" "}
          <Link href="/dpa" className="font-medium text-teal-800 underline underline-offset-4">
            data processing agreement
          </Link>
          .
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href={PRIMARY_CTA.href} size="lg">
            {PRIMARY_CTA.label}
          </LinkButton>
          <LinkButton href="/request-callback?topic=walkthrough" variant="secondary" size="lg">
            Book a walkthrough
          </LinkButton>
        </div>
      </section>
    </>
  );
}
