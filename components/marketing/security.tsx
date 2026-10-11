const points = [
  {
    icon: "🇬🇧",
    title: "Stored and run in the UK",
    body: "Your data is held in London (Supabase) and the app runs from London (Vercel). Messages are delivered by Twilio (texts) and Resend (email).",
  },
  {
    icon: "🔒",
    title: "Each practice sealed off from every other",
    body: "Every record carries its practice, and the database itself refuses to return another practice's data — a rule checked on every request, not just hidden in the screens.",
  },
  {
    icon: "👤",
    title: "Roles decide who sees what",
    body: "Owners manage settings and the team. Staff do the day-to-day work. Dentists see only their own patients' quotes and their own figures — never a colleague's.",
  },
  {
    icon: "🧾",
    title: "A consent record you can produce",
    body: "Each quote's opt-out confirmation is stored with who recorded it and when, and can never be edited or deleted — only added to. STOP replies are written to the same record.",
  },
  {
    icon: "✋",
    title: "Opt-out honoured instantly",
    body: "Every message says how to stop. A STOP reply halts every pending message for that patient straight away, and they can't be re-added to follow-up without their fresh agreement on record.",
  },
  {
    icon: "📦",
    title: "Only what follow-up needs",
    body: "Name, mobile, optional email, the treatment quoted and its value. No dates of birth, medical history, clinical notes or radiographs — TreatmentTrack never asks for them.",
  },
  {
    icon: "🔑",
    title: "Read-only practice software connections",
    body: "Connections to practice software only ever read, and their keys are encrypted (AES-256-GCM) before they're stored and never shown again in the app.",
  },
  {
    icon: "🍪",
    title: "Nobody tracking your team",
    body: "No advertising or analytics trackers in the app — only the cookie that keeps you signed in.",
  },
];

export function Security() {
  return (
    <section id="security" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Security</p>
        <h2 className="mt-3 font-display text-3xl font-medium text-ink-900 md:text-4xl">
          Patient data is sensitive. We designed around that from day one.
        </h2>
        <p className="mt-4 text-ink-500">Specifics, not a padlock icon and a promise.</p>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {points.map((p) => (
          <div key={p.title} className="rounded-xl border border-ink-900/8 bg-cream-0 p-5">
            <p className="text-2xl" aria-hidden>
              {p.icon}
            </p>
            <h3 className="mt-3 font-display text-lg font-medium text-ink-900">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
