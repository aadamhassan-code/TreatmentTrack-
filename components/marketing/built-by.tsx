/**
 * Who's behind TreatmentTrack. Keep this accurate — it's a factual claim on
 * a public page (ASA / CAP code). Change BUILT_BY in one place if needed.
 */
export const BUILT_BY = "Built by UK dentists";

export function BuiltBy() {
  return (
    <section id="about" className="mx-auto max-w-4xl scroll-mt-20 px-6 py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">{BUILT_BY}</p>
      <h2 className="mt-3 font-display text-3xl font-medium text-ink-900 md:text-4xl">
        We&rsquo;ve watched good treatment plans go quiet from the other side of the chair.
      </h2>
      <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink-700">
        <p>
          A patient sits through the consultation, nods at the plan, takes the estimate home — and that&rsquo;s the
          last anyone hears of it. Not because they said no, but because nobody had the time to ask again.
        </p>
        <p>
          TreatmentTrack was built by UK dentists to do that asking for you: politely, in your practice&rsquo;s own
          words, on a schedule you choose, and only for patients who were offered the chance to opt out. It stops the
          moment they book or say no — and it shows you exactly what it recovered.
        </p>
      </div>
    </section>
  );
}
