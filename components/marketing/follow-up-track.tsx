/**
 * The homepage's signature visual: one real quote travelling along its
 * follow-up track, from the consultation to booked. Message wording is the
 * product's own default template, so what's shown is what patients get.
 * Horizontal on wide screens, vertical on phones.
 */

type Stop =
  | { kind: "quote"; when: string }
  | { kind: "sms"; when: string; body: string }
  | { kind: "event"; when: string; title: string; note: string }
  | { kind: "booked"; when: string };

const STOPS: Stop[] = [
  { kind: "quote", when: "Consultation" },
  {
    kind: "sms",
    when: "Day 3",
    body: "Hi Priya, just checking in about the treatment we discussed at Riverside Dental. Ready to book, or have questions? Reply STOP to opt out.",
  },
  {
    kind: "sms",
    when: "Day 7",
    body: "Hi Priya, your treatment plan from Riverside Dental is still open. Happy to talk it through before you decide. Reply STOP to opt out.",
  },
  {
    kind: "event",
    when: "Day 9",
    title: "Priya rings to book",
    note: "Reception books her in Dentally.",
  },
  { kind: "booked", when: "Same day" },
];

function StopCard({ stop }: { stop: Stop }) {
  switch (stop.kind) {
    case "quote":
      return (
        <div className="rounded-xl bg-cream-50 p-4 text-ink-900 shadow-lg shadow-teal-950/30">
          <p className="text-[13px] text-ink-500">Quote given to Priya Shah</p>
          <p className="mt-1 font-medium">Implant, upper left</p>
          <p className="mt-2 font-mono text-xl font-medium">£2,450</p>
          <p className="mt-2 border-t border-ink-900/8 pt-2 text-[12px] leading-snug text-teal-700">
            Opt-out offered and recorded
          </p>
        </div>
      );
    case "sms":
      return (
        <div className="rounded-2xl rounded-tl-md bg-cream-0 p-4 text-[13px] leading-snug text-ink-900 shadow-lg shadow-teal-950/30">
          <p className="mb-1.5 text-[11px] font-semibold text-teal-700">Text from Riverside Dental</p>
          {stop.body}
        </div>
      );
    case "event":
      return (
        <div className="rounded-xl border border-cream-50/15 bg-teal-800/60 p-4 text-cream-50">
          <p className="font-medium">{stop.title}</p>
          <p className="mt-1 text-[13px] leading-snug text-teal-200">{stop.note}</p>
        </div>
      );
    case "booked":
      return (
        <div className="rounded-xl bg-gold-200 p-4 text-ink-900 shadow-lg shadow-teal-950/30">
          <p className="text-[13px] font-semibold text-gold-700">Booked</p>
          <p className="mt-1 font-mono text-xl font-medium">+£2,450</p>
          <p className="mt-2 text-[12px] leading-snug text-ink-700">
            Remaining messages cancelled by themselves
          </p>
        </div>
      );
  }
}

export function FollowUpTrack() {
  return (
    <figure>
      <figcaption className="sr-only">An example quote, followed up until the patient books.</figcaption>
      {/* Wide screens: a horizontal track with the stops hanging below it. */}
      <div className="relative hidden lg:block">
        <div className="absolute left-[10%] right-[10%] top-[34px] h-[3px] rounded-full bg-cream-50/10" />
        <div className="track-line-x absolute left-[10%] right-[10%] top-[34px] h-[3px] rounded-full bg-gold-400" />
        <ol className="relative grid grid-cols-5 gap-5">
          {STOPS.map((stop, i) => (
            <li
              key={i}
              className="track-stop flex flex-col items-center"
              style={{ "--i": i } as React.CSSProperties}
            >
              <span className="text-[13px] font-medium text-teal-200">{stop.when}</span>
              <span
                aria-hidden
                className={`mt-2 h-4 w-4 rounded-full border-[3px] ${
                  stop.kind === "booked" ? "border-gold-400 bg-gold-400" : "border-gold-400 bg-teal-900"
                }`}
              />
              <div className="mt-5 w-full text-left">
                <StopCard stop={stop} />
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Phones and tablets: the same track, running down the page. */}
      <div className="relative lg:hidden">
        <ol className="relative space-y-6">
          {STOPS.map((stop, i) => (
            <li
              key={i}
              className="track-stop relative pl-9"
              style={{ "--i": i } as React.CSSProperties}
            >
              {/* Segment down to the next stop; the last stop has none. */}
              {i < STOPS.length - 1 && (
                <span aria-hidden className="absolute -bottom-6 left-[7px] top-4 w-[3px] bg-gold-400" />
              )}
              <span
                aria-hidden
                className={`absolute left-0 top-0.5 h-[17px] w-[17px] rounded-full border-[3px] ${
                  stop.kind === "booked" ? "border-gold-400 bg-gold-400" : "border-gold-400 bg-teal-900"
                }`}
              />
              <p className="mb-2 text-[13px] font-medium text-teal-200">{stop.when}</p>
              <div className="max-w-sm">
                <StopCard stop={stop} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}
