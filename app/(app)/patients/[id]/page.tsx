import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { listTreatingDentists, requireCurrentPractice } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatGBP } from "@/lib/utils";
import { displayStatus } from "@/lib/treatment-status";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErasePatient } from "@/components/patients/erase-patient";
import type { Patient, Treatment } from "@/lib/types";
import { isMissingSchema } from "@/lib/supabase/compat";

type Step = {
  step: number;
  channel: "sms" | "whatsapp" | "email";
  status: string;
  scheduled_for: string;
  sent_at: string | null;
  error: string | null;
};

const CHANNEL: Record<Step["channel"], string> = { sms: "Text", whatsapp: "WhatsApp", email: "Email" };

function stepLine(s: Step): { text: string; tone: string } {
  switch (s.status) {
    case "sent":
      return { text: `Sent ${formatDate(s.sent_at ?? s.scheduled_for)}`, tone: "text-teal-700" };
    case "pending":
      return { text: `Due ${formatDate(s.scheduled_for)}`, tone: "text-ink-700" };
    case "failed":
      return { text: `Not sent: ${s.error ?? "delivery failed"}`, tone: "text-clay-700" };
    case "skipped_no_consent":
      return { text: "Not sent: patient had opted out", tone: "text-ink-500" };
    default:
      return { text: s.error ? `Cancelled: ${s.error}` : "Cancelled", tone: "text-ink-500" };
  }
}

const CONSENT_LABEL = {
  quote_followup: "Follow-up on a quote",
  cross_sell: "Suggestions for other treatment",
} as const;

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { practice, role } = await requireCurrentPractice();
  const supabase = await createClient();

  const load = (cols: string) =>
    supabase.from("patients").select(cols).eq("id", id).eq("practice_id", practice.id).maybeSingle();
  const base = "id, practice_id, full_name, phone, email, opted_out_at, created_at";
  let { data: row, error: loadError } = await load(`${base}, erased_at`);
  if (isMissingSchema(loadError)) ({ data: row, error: loadError } = await load(base));
  const patient = row as unknown as (Patient & { erased_at?: string | null }) | null;
  if (!patient || patient.erased_at) notFound();

  const [{ data: treatments }, { data: consents }, dentists] = await Promise.all([
    supabase
      .from("treatments")
      .select("*, sequence_steps(step, channel, status, scheduled_for, sent_at, error)")
      .eq("patient_id", id)
      .order("quoted_on", { ascending: false }),
    supabase
      .from("consents")
      .select("id, category, granted, source, captured_at, notes")
      .eq("patient_id", id)
      .order("captured_at", { ascending: false }),
    role === "dentist" ? Promise.resolve([]) : listTreatingDentists(practice.id),
  ]);
  const dentistName = new Map(dentists.map((d) => [d.userId, d.name]));
  const canManageData = role === "owner" || role === "staff";
  const quotes = ((treatments ?? []) as (Treatment & { sequence_steps: Step[] })[]).map((t) => ({
    ...t,
    patient: patient as unknown as Patient,
  }));

  return (
    <div className="max-w-4xl space-y-8">
      <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All patients
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink-900">{patient.full_name}</h1>
          <p className="mt-1.5 text-sm text-ink-700">
            {patient.phone}
            {patient.email ? <span className="text-ink-500"> &nbsp;|&nbsp; {patient.email}</span> : null}
          </p>
          <p className="mt-2 text-sm">
            {patient.opted_out_at ? (
              <span className="rounded bg-rose px-1.5 py-0.5 font-medium text-ink-900">
                Opted out on {formatDate(patient.opted_out_at)}
              </span>
            ) : (
              <span className="text-ink-500">Added {formatDate(patient.created_at)}</span>
            )}
          </p>
        </div>
        {canManageData && (
          <a
            href={`/api/patients/${patient.id}/export`}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-4 py-2.5 text-sm font-medium text-ink-900 hover:bg-teal-100"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export their data
          </a>
        )}
      </div>

      <section>
        <h2 className="font-display text-xl text-ink-900">Quotes and messages</h2>
        {quotes.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No quotes for this patient.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {quotes.map((t) => {
              const steps = [...t.sequence_steps].sort(
                (a, b) => a.scheduled_for.localeCompare(b.scheduled_for) || a.channel.localeCompare(b.channel)
              );
              return (
                <li key={t.id} className="rounded-xl border border-ink-900/8 bg-cream-0 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{t.treatment_type}</p>
                      <p className="mt-0.5 text-sm text-ink-500">
                        Quoted {formatDate(t.quoted_on)}
                        {t.dentist_user_id && dentistName.get(t.dentist_user_id)
                          ? ` by ${dentistName.get(t.dentist_user_id)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-ink-900">{formatGBP(t.value_pence)}</span>
                      <StatusBadge status={displayStatus(t)} />
                    </div>
                  </div>
                  {steps.length > 0 && (
                    <ol className="mt-4 space-y-1.5 border-t border-ink-900/6 pt-3">
                      {steps.map((s, i) => {
                        const line = stepLine(s);
                        return (
                          <li key={i} className="flex flex-wrap justify-between gap-x-4 text-sm">
                            <span className="text-ink-700">
                              Message {s.step} <span className="text-ink-500">by {CHANNEL[s.channel]}</span>
                            </span>
                            <span className={line.tone}>{line.text}</span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl text-ink-900">Consent history</h2>
        <p className="mt-1 text-sm text-ink-500">
          Every permission recorded for this patient, newest first. Records can be added to but never changed.
        </p>
        {(consents ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No consent recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-900/6 rounded-xl border border-ink-900/8 bg-cream-0">
            {(consents ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 px-5 py-3.5 text-sm">
                <div className="min-w-0">
                  <p className="text-ink-900">
                    <span className={c.granted ? "font-medium text-teal-700" : "font-medium text-clay-700"}>
                      {c.granted ? "Given" : "Withdrawn"}
                    </span>{" "}
                    {CONSENT_LABEL[c.category as keyof typeof CONSENT_LABEL] ?? c.category}
                  </p>
                  {c.notes && <p className="mt-0.5 text-ink-500">{c.notes}</p>}
                </div>
                <p className="shrink-0 text-ink-500">
                  {formatDate(c.captured_at)} {c.source === "patient_reply" ? "by the patient" : "by staff"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManageData && (
        <section className="rounded-xl border border-clay-500/30 bg-cream-0 p-5">
          <h2 className="font-semibold text-ink-900">Erase this patient</h2>
          <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-700">
            Use this when a patient asks for their data to be deleted. Their details, quotes, messages and cases
            are removed for good. A coded do-not-contact marker stays, so they&rsquo;re never messaged again if
            they&rsquo;re imported later. Export their data first if they&rsquo;ve also asked for a copy.
          </p>
          <ErasePatient patientId={patient.id} patientName={patient.full_name} />
        </section>
      )}
    </div>
  );
}
