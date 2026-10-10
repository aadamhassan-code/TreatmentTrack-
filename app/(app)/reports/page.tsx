import Link from "next/link";
import { LedgerStat } from "@/components/ui/ledger-stat";
import { Card, CardBody } from "@/components/ui/card";
import { cn, formatGBP } from "@/lib/utils";
import { listTreatingDentists, requireCurrentPractice } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import {
  REPORT_PERIODS,
  buildReport,
  parsePeriod,
  periodStart,
  type ReportTreatment,
  type Tally,
} from "@/lib/reports";

function percent(rate: number | null): string {
  return rate == null ? "—" : `${Math.round(rate * 100)}%`;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { practice, role } = await requireCurrentPractice();
  const isDentist = role === "dentist";
  const supabase = await createClient();
  const period = parsePeriod((await searchParams).period);
  const from = periodStart(period);

  const [treatments, sentRes, failedRes, optOutRes] = await Promise.all([
    // Everything, not just quotes made in the period: a quote from last
    // month booked this month still counts as recovered this month.
    fetchAll<ReportTreatment>((lo, hi) =>
      supabase
        .from("treatments")
        .select("treatment_type, value_pence, status, quoted_on, converted_at, dentist_user_id")
        .eq("practice_id", practice.id)
        .order("id")
        .range(lo, hi)
    ),
    countSteps("sent", "sent_at"),
    countSteps("failed", "scheduled_for"),
    (() => {
      let q = supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("practice_id", practice.id)
        .not("opted_out_at", "is", null);
      if (from) q = q.gte("opted_out_at", from);
      return q;
    })(),
  ]);

  function countSteps(status: string, dateColumn: string) {
    let q = supabase
      .from("sequence_steps")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practice.id)
      .eq("status", status);
    if (from) q = q.gte(dateColumn, from);
    return q;
  }

  const report = buildReport(treatments, from);
  const dentistNames = Object.fromEntries(
    (isDentist ? [] : await listTreatingDentists(practice.id)).map((d) => [d.userId, d.name])
  );
  const showByDentist = !isDentist && report.byDentist.some((d) => d.dentistUserId);
  const periodLabel = REPORT_PERIODS.find((p) => p.value === period)!.phrase;

  const outcomes: { label: string; tally: Tally; className: string }[] = [
    { label: "Booked", tally: report.booked, className: "bg-gold-500" },
    { label: "Still open", tally: report.open, className: "bg-teal-700" },
    { label: "Declined", tally: report.declined, className: "bg-ink-500" },
    { label: "Lost", tally: report.lost, className: "bg-clay-500" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink-900">{isDentist ? "My reports" : "Reports"}</h1>
          <p className="mt-1 text-sm text-ink-500">{practice.name}</p>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-lg border border-ink-900/10 bg-cream-0 p-1" aria-label="Report period">
          {REPORT_PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/reports?period=${p.value}`}
              aria-current={p.value === period ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                p.value === period ? "bg-teal-900 text-cream-50" : "text-ink-700 hover:bg-ink-900/5"
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <LedgerStat
          label="Recovered"
          value={formatGBP(report.recovered.valuePence)}
          caption={`${plural(report.recovered.count, "quote")} booked ${periodLabel}`}
          accent
        />
        <LedgerStat
          label="Quoted"
          value={formatGBP(report.quoted.valuePence)}
          caption={`${plural(report.quoted.count, "quote")} made ${periodLabel}`}
        />
        <LedgerStat
          label="Booking rate"
          value={percent(report.bookingRate)}
          caption={`of quotes made ${periodLabel} have booked so far`}
        />
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-medium text-ink-900">
              What happened to quotes made {periodLabel}
            </h2>
            <p className="mt-1 text-sm text-ink-500">Grouped by the date the patient was quoted.</p>
          </div>
          {report.quoted.count > 0 && (
            <div className="flex h-3 overflow-hidden rounded-full bg-ink-900/5" aria-hidden>
              {outcomes.map((o) =>
                o.tally.count > 0 ? (
                  <div
                    key={o.label}
                    className={o.className}
                    style={{ width: `${(o.tally.count / report.quoted.count) * 100}%` }}
                  />
                ) : null
              )}
            </div>
          )}
          <dl className="grid gap-4 sm:grid-cols-4">
            {outcomes.map((o) => (
              <div key={o.label}>
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <span className={cn("h-2 w-2 rounded-full", o.className)} aria-hidden />
                  {o.label}
                </dt>
                <dd className="mt-1 font-mono text-lg tabular-nums text-ink-900">{o.tally.count}</dd>
                <dd className="font-mono text-sm tabular-nums text-ink-500">{formatGBP(o.tally.valuePence)}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-3 font-display text-xl font-medium text-ink-900">By treatment</h2>
        {report.byTreatment.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-900/15 px-6 py-10 text-center text-sm text-ink-500">
            No quotes made {periodLabel}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-cream-0">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink-900/8 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Treatment</th>
                  <th className="px-5 py-3 text-right font-medium">Quotes</th>
                  <th className="px-5 py-3 text-right font-medium">Quoted value</th>
                  <th className="px-5 py-3 text-right font-medium">Booked</th>
                  <th className="px-5 py-3 text-right font-medium">Booked value</th>
                  <th className="px-5 py-3 text-right font-medium">Booking rate</th>
                </tr>
              </thead>
              <tbody>
                {report.byTreatment.map((row) => (
                  <tr key={row.treatmentType} className="border-b border-ink-900/6 last:border-0">
                    <td className="px-5 py-3 text-ink-900">{row.treatmentType}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{row.quoted.count}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{formatGBP(row.quoted.valuePence)}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{row.booked.count}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{formatGBP(row.booked.valuePence)}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{percent(row.bookingRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showByDentist && (
        <div>
          <h2 className="mb-3 font-display text-xl font-medium text-ink-900">By dentist</h2>
          <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-cream-0">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink-900/8 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Dentist</th>
                  <th className="px-5 py-3 text-right font-medium">Quotes</th>
                  <th className="px-5 py-3 text-right font-medium">Quoted value</th>
                  <th className="px-5 py-3 text-right font-medium">Booking rate</th>
                  <th className="px-5 py-3 text-right font-medium">Recovered</th>
                </tr>
              </thead>
              <tbody>
                {report.byDentist.map((row) => (
                  <tr key={row.dentistUserId ?? "none"} className="border-b border-ink-900/6 last:border-0">
                    <td className="px-5 py-3 text-ink-900">
                      {row.dentistUserId ? (dentistNames[row.dentistUserId] ?? "Former team member") : "Not assigned"}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{row.quoted.count}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{formatGBP(row.quoted.valuePence)}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{percent(row.bookingRate)}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{formatGBP(row.recovered.valuePence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Quotes and booking rate are for quotes made {periodLabel}; recovered is everything booked {periodLabel}.
          </p>
        </div>
      )}

      <div>
        <h2 className="mb-3 font-display text-xl font-medium text-ink-900">Follow-up messages</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <LedgerStat label="Sent" value={String(sentRes.count ?? 0)} caption={`messages sent ${periodLabel}`} />
          <LedgerStat
            label="Failed"
            value={String(failedRes.count ?? 0)}
            caption="e.g. no number on file, or SMS/email not connected"
          />
          <LedgerStat
            label="Opt-outs"
            value={String(optOutRes.count ?? 0)}
            caption={`patients who replied STOP ${periodLabel}`}
          />
        </div>
      </div>
    </div>
  );
}
