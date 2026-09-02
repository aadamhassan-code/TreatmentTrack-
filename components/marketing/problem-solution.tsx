const problems = [
  "The treatment coordinator quotes the case, the patient says “I'll think about it,” and nobody owns the follow-up after that.",
  "Recall software from Dentally or SOE reminds patients about their next check-up — it was never built to chase a specific declined quote.",
  "By the time anyone remembers to call back, the quote is six weeks old, the patient has half-forgotten it, and the treatment coordinator has forty other things to do.",
];

const solutions = [
  "Every declined quote gets logged once, with consent captured at that exact moment — then it follows up itself.",
  "A fixed Day 3 / 7 / 14 / 30 sequence across SMS, WhatsApp and email, in your practice's own words, until the patient books or opts out.",
  "One dashboard shows exactly how much quoted treatment is still open, and how much you've recovered this month, in pounds.",
];

export function ProblemSolution() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="rounded-2xl border border-clay-500/20 bg-clay-100/40 p-8">
          <p className="font-display text-2xl font-medium text-clay-700">
            What happens today
          </p>
          <ul className="mt-6 space-y-4">
            {problems.map((text) => (
              <li key={text} className="text-sm leading-relaxed text-ink-700">
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-teal-700/20 bg-teal-50 p-8">
          <p className="font-display text-2xl font-medium text-teal-800">
            What TreatmentTrack does instead
          </p>
          <ul className="mt-6 space-y-4">
            {solutions.map((text) => (
              <li key={text} className="text-sm leading-relaxed text-ink-700">
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
