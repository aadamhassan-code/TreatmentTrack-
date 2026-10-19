/**
 * "How it works", shown as the screen a practice actually sees: today's
 * follow-ups going out, ones paused, and ones that stopped by themselves.
 */

type Row = { name: string; treatment: string; value: string; status: string; tone: "send" | "pause" | "stop" };

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: "Going out at 8:00",
    rows: [
      { name: "Priya Shah", treatment: "Implant, upper left", value: "£2,450", status: "2nd text", tone: "send" },
      { name: "James Wilson", treatment: "Invisalign", value: "£3,200", status: "1st text and email", tone: "send" },
      { name: "Grace Obi", treatment: "Four veneers", value: "£2,900", status: "3rd text", tone: "send" },
    ],
  },
  {
    title: "Paused",
    rows: [
      { name: "Fatima Ahmed", treatment: "Whitening", value: "£395", status: "Until 6 Jan", tone: "pause" },
    ],
  },
  {
    title: "Stopped by themselves",
    rows: [
      { name: "Ann Riley", treatment: "Implant crown", value: "£2,600", status: "Booked in Dentally", tone: "stop" },
      { name: "Tom Ellis", treatment: "Crown, UR6", value: "£850", status: "Replied STOP", tone: "stop" },
    ],
  },
];

const TONE: Record<Row["tone"], string> = {
  send: "bg-teal-100 text-teal-800",
  pause: "bg-butter text-gold-700",
  stop: "bg-cream-100 text-ink-500",
};

const POINTS = [
  {
    title: "Your schedule",
    body: "Up to six messages per quote, sent after the number of days you choose. Three days, a week, two weeks and a month to start with.",
  },
  {
    title: "Your words",
    body: "Sent by text and email in your practice’s name, and by WhatsApp once your sender is approved. Every message says how to opt out.",
  },
  {
    title: "Pause for later",
    body: "Patient says “after Christmas”? Pause their follow-up until a date and it picks up again on its own.",
  },
  {
    title: "Stops on its own",
    body: "A booking, a decline or a STOP reply ends the follow-up straight away. Nobody gets chased after they’ve said yes.",
  },
];

function TodayPanel() {
  return (
    <div className="rounded-2xl border border-ink-900/8 bg-cream-0 shadow-xl shadow-ink-900/[0.06]">
      <div className="flex items-center justify-between border-b border-ink-900/8 px-5 py-4">
        <p className="font-medium text-ink-900">Follow-ups today</p>
        <p className="text-[13px] text-ink-500">Tuesday 21 October</p>
      </div>
      <div className="divide-y divide-ink-900/5">
        {SECTIONS.map((section) => (
          <div key={section.title} className="px-5 py-4">
            <p className="text-[13px] font-medium text-ink-500">{section.title}</p>
            <ul className="mt-2 space-y-2.5">
              {section.rows.map((r) => (
                <li key={r.name} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[1fr_auto_auto]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{r.name}</p>
                    <p className="truncate text-[13px] text-ink-500">{r.treatment}</p>
                  </div>
                  <p className="text-right font-mono text-sm text-ink-700">{r.value}</p>
                  <p className={`col-span-2 justify-self-start rounded-md px-2 py-0.5 text-[12px] font-medium sm:col-span-1 sm:justify-self-end ${TONE[r.tone]}`}>
                    {r.status}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DailyChase() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16">
        <div className="lg:order-2">
          <h2 className="font-display text-3xl leading-tight text-ink-900 md:text-[40px]">
            The follow-ups go out every morning. Nobody has to remember.
          </h2>
          <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-ink-500">
            Log a quote once, with the patient&rsquo;s opt-out recorded, and TreatmentTrack does the chasing. Your
            team just sees who&rsquo;s been contacted, who&rsquo;s paused, and who has booked.
          </p>
          <dl className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {POINTS.map((p) => (
              <div key={p.title}>
                <dt className="font-semibold text-ink-900">{p.title}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-ink-500">{p.body}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="lg:order-1">
          <TodayPanel />
        </div>
      </div>
    </section>
  );
}
