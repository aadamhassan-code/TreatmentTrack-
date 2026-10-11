import Link from "next/link";

const questions: { q: string; a: React.ReactNode }[] = [
  {
    q: "What does the patient actually receive?",
    a: "A short, polite text or email in your practice's name and your own words — for example \"Hi Priya, just checking in about the implant we quoted…\". You choose how many go and when (3 days, 1 week and 1 month after the quote, say). Every message says how to opt out, and it stops as soon as they book, decline or reply STOP.",
  },
  {
    q: "Is it GDPR and PECR compliant?",
    a: "It's designed around both. Following up a quote relies on PECR's \"soft opt-in\", so for every quote your team confirms the patient was offered an opt-out, and that's stored as a permanent, timestamped record. Every message carries an opt-out, STOP is honoured immediately, and data is held in the UK. Your practice remains the data controller; TreatmentTrack processes data on your behalf.",
  },
  {
    q: "Can one dentist see another dentist's patients or figures?",
    a: "No. A dentist login only ever sees their own patients' quotes, messages and reports. That's enforced by the database itself, not just hidden in the screens. Owners and staff see the whole practice, including a by-dentist report.",
  },
  {
    q: "What happens when an associate leaves?",
    a: "An owner removes them from the Team page and their access ends straight away. Their quotes stay with the practice — they're the practice's patients — and owners and staff carry on following them up.",
  },
  {
    q: "What if a patient says \"after Christmas\"?",
    a: "Click Pause and pick the date. Nothing is sent until then; on that day the first message goes and the rest follow your schedule.",
  },
  {
    q: "Do we need Dentally or SOE?",
    a: "No. Add quotes in a few seconds, or import a spreadsheet exported from any practice software. A direct, read-only Dentally connection is coming, so unbooked treatment plans come in by themselves and quotes close when the patient is booked.",
  },
  {
    q: "Can an associate start using it without the practice owner?",
    a: "They can set it up and add their quotes, but nothing is sent until the practice owner approves — because the messages go out in the practice's name. The owner gets a one-click approval link that explains exactly what they're agreeing to.",
  },
  {
    q: "Where is our data kept?",
    a: "In London. Both the database and the app run from UK data centres.",
  },
];

export function Faq() {
  return (
    <section id="questions" className="scroll-mt-20 bg-cream-0 py-20">
      <div className="mx-auto max-w-4xl px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Questions owners ask</p>
        <h2 className="mt-3 font-display text-3xl font-medium text-ink-900 md:text-4xl">Answered plainly.</h2>
        <div className="mt-10 divide-y divide-ink-900/8 rounded-xl border border-ink-900/8 bg-cream-50">
          {questions.map(({ q, a }) => (
            <details key={q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink-900">
                {q}
                <span aria-hidden className="text-xl text-teal-700 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-ink-700">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center text-ink-500">
          Something else?{" "}
          <Link href="/request-callback?topic=walkthrough" className="font-medium text-teal-700 underline">
            Talk to us first
          </Link>{" "}
          — we&rsquo;ll walk you through it, no obligation.
        </p>
      </div>
    </section>
  );
}
