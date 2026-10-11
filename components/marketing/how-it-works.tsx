const steps = [
  {
    number: "01",
    title: "Log the declined quote",
    body: "Patient, treatment type and value — plus the one thing that matters legally: confirmation that opt-out was offered for follow-up on this exact quote.",
  },
  {
    number: "02",
    title: "The sequence runs itself",
    body: "Follow-ups go out on your schedule — 3 days, 1 week, 2 weeks and 1 month by default, or your own — on the channels you've enabled, in your practice's words, with an opt-out on every message. Patient says \"after Christmas\"? Pause it until then.",
  },
  {
    number: "03",
    title: "Patient books, opts out, or you close it",
    body: "A booking marks the case converted automatically once you log it. Otherwise mark it lost, or let it run — either way the sequence stops the moment they opt out.",
  },
  {
    number: "04",
    title: "See what you recovered",
    body: "Your dashboard totals pipeline value and revenue recovered this month, so you can point to a real number, not a feeling.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
          How it works
        </p>
        <h2 className="mt-3 font-display text-3xl font-medium text-ink-900 md:text-4xl">
          Four steps, and the follow-up is no longer anyone&rsquo;s job to remember.
        </h2>
      </div>
      <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <div key={step.number}>
            <p className="font-mono text-sm text-gold-600">{step.number}</p>
            <h3 className="mt-3 font-display text-xl font-medium text-teal-900">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
