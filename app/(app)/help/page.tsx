import Link from "next/link";
import { requireCurrentPractice } from "@/lib/practice";
import { SupportForm } from "@/components/forms/support-form";

const GUIDES: { q: string; a: React.ReactNode }[] = [
  {
    q: "How do I start following up a quote?",
    a: (
      <>
        Use <Link href="/treatments/new" className="font-medium text-teal-700 underline">Add a quote</Link>, or bring
        many in at once with{" "}
        <Link href="/treatments/import" className="font-medium text-teal-700 underline">Import spreadsheet</Link>. Tick
        that the patient was offered an opt-out, and the first message goes out on the day your schedule says.
      </>
    ),
  },
  {
    q: "What do patients receive, and can I change it?",
    a: (
      <>
        Short texts or emails in your practice&rsquo;s name, on the schedule in{" "}
        <Link href="/settings" className="font-medium text-teal-700 underline">Settings</Link>. Owners can change the
        wording and timing there. Every message tells the patient how to opt out.
      </>
    ),
  },
  {
    q: "A patient has booked. What do I do?",
    a: "Press Booked next to their quote on the dashboard. Their remaining messages stop at once and they move onto the Cases board.",
  },
  {
    q: "A patient wants their data, or wants it deleted.",
    a: (
      <>
        Find them in <Link href="/patients" className="font-medium text-teal-700 underline">Patients</Link>, open
        their record and use Export (for a copy) or Erase. Both are recorded in your audit log.
      </>
    ),
  },
  {
    q: "How do I protect my login?",
    a: (
      <>
        Turn on two-factor sign-in under{" "}
        <Link href="/settings?tab=privacy" className="font-medium text-teal-700 underline">
          Settings, Privacy &amp; security
        </Link>
        . You&rsquo;ll need an authenticator app on your phone.
      </>
    ),
  },
];

export default async function HelpPage() {
  const { practice } = await requireCurrentPractice();

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="font-display text-3xl text-ink-900">Help &amp; support</h1>
        <p className="mt-1 text-sm text-ink-500">Quick answers, or send us a message and we&rsquo;ll get back to you.</p>
      </div>

      <section>
        <h2 className="font-display text-xl text-ink-900">Quick answers</h2>
        <div className="mt-3 divide-y divide-ink-900/8 rounded-xl border border-ink-900/8 bg-cream-0">
          {GUIDES.map(({ q, a }) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink-900">
                {q}
                <span aria-hidden className="text-lg text-teal-700 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink-900">Message the TreatmentTrack team</h2>
        <p className="mt-1 text-sm text-ink-500">
          From {practice.name}. Please don&rsquo;t include patient details unless we ask for them.
        </p>
        <div className="mt-3">
          <SupportForm />
        </div>
      </section>
    </div>
  );
}
