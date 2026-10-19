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
import { buildCaseReport, pickBoard, type CaseRow, type CaseStage } from "@/lib/cases";
import { DentistFilter } from "@/components/dashboard/dentist-filter";
import { RevenueChart } from "@/components/reports/revenue-chart";
import { monthlyBooked, type PerfTreatment } from "@/lib/performance";
import { loadMarginInputs } from "@/lib/margin-inputs";
import { addMargin, emptyMargin, estimateMargin, marginRate, type MarginBreakdown } from "@/lib/margins";
import { ukDate } from "@/lib/utils";

function percent(rate: number | null): string {
  return rate == null ? "–" : `${Math.round(rate * 100)}%`;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { practice, role, userId, treatsPatients } = await requireCurrentPractice();
  const isDentist = role === "dentist";
  const supabase = await createClient();
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const from = periodStart(period);
  // Owners and staff can narrow every figure to one dentist.
  const rawDentist = typeof sp.dentist === "string" ? sp.dentist : "";
  const dentistFilter = isDentist ? "" : rawDentist === "me" ? userId : rawDentist;
  const matchesDentist = (id: string | null | undefined) =>
    !dentistFilter || (dentistFilter === "unassigned" ? !id : id === dentistFilter);

  const [treatments, sentRes, failedRes, optOutRes, caseRows, { data: caseBoards }, { data: caseStages }] = await Promise.all([
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
    fetchAll<Pick<CaseRow, "board_id" | "stage_id" | "status" | "stage_entered_at" | "completed_at" | "created_at" | "value_pence"> & { dentist_user_id: string | null }>((lo, hi) =>
      supabase
        .from("cases")
        .select("board_id, stage_id, status, stage_entered_at, completed_at, created_at, value_pence, dentist_user_id")
        .eq("practice_id", practice.id)
        .in("status", ["active", "completed"])
        .order("id")
        .range(lo, hi)
    ),
    supabase.from("case_boards").select("id, name").eq("practice_id", practice.id).order("position"),
    supabase.from("case_stages").select("id, expected_days").eq("practice_id", practice.id),
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

  const scopedTreatments = treatments.filter((t) => matchesDentist(t.dentist_user_id));
  const report = buildReport(scopedTreatments, from);
  const dentistList = isDentist ? [] : await listTreatingDentists(practice.id);
  const dentistNames = Object.fromEntries(dentistList.map((d) => [d.userId, d.name]));
  const months = monthlyBooked(scopedTreatments as PerfTreatment[]);

  // Owners: estimated margin on everything booked in the period, by kind of treatment.
  const margins = await loadMarginInputs(supabase, practice.id, role);
  let marginTotal: MarginBreakdown = emptyMargin();
  const marginByCategory = new Map<string, MarginBreakdown>();
  if (margins) {
    for (const t of scopedTreatments) {
      if (t.status !== "converted" || !t.converted_at || (from && ukDate(t.converted_at) < from)) continue;
      const m = estimateMargin(t, margins);
      marginTotal = addMargin(marginTotal, m);
      const cat = pickBoard(margins.boards, t.treatment_type)?.name ?? "Other";
      marginByCategory.set(cat, addMargin(marginByCategory.get(cat) ?? emptyMargin(), m));
    }
  }
  const qs = (extra: Record<string, string>) => {
    const params = new URLSearchParams({ period, ...(rawDentist && !isDentist ? { dentist: rawDentist } : {}), ...extra });
    return `/reports?${params.toString()}`;
  };
  const showByDentist = !isDentist && report.byDentist.some((d) => d.dentistUserId);
  const periodLabel = REPORT_PERIODS.find((p) => p.value === period)!.phrase;
  const boardOrder = (caseBoards ?? []).map((b) => b.id as string);
  const caseReport = buildCaseReport(caseRows.filter((c) => matchesDentist(c.dentist_user_id)), (caseStages ?? []) as CaseStage[], from).sort(
    (a, b) => (a.boardId ? boardOrder.indexOf(a.boardId) : 999) - (b.boardId ? boardOrder.indexOf(b.boardId) : 999)
  );
  const boardNames = Object.fromEntries((caseBoards ?? []).map((b) => [b.id, b.name as string]));

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
          <h1 className="font-display text-3xl text-ink-900">{isDentist ? "My reports" : "Reports"}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {practice.name}
            {dentistFilter && (
              <> | {dentistFilter === "unassigned" ? "Not assigned to a dentist" : (dentistNames[dentistFilter] ?? "One dentist")}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {!isDentist && dentistList.length > 0 && (
          <DentistFilter
            dentists={dentistList}
            value={dentistFilter}
            myId={treatsPatients ? userId : null}
            basePath={`/reports?period=${period}`}
            mineLabel="My figures"
          />
        )}
        <nav className="flex flex-wrap gap-1 rounded-lg border border-ink-900/10 bg-cream-0 p-1" aria-label="Report period">
          {REPORT_PERIODS.map((p) => (
            <Link
              key={p.value}
              href={qs({ period: p.value })}
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
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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

      <RevenueChart points={months} title="Revenue booked, last 12 months" />

      {margins && (
        <Card>
          <CardBody className="space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl text-ink-900">Estimated margin on treatment booked {periodLabel}</h2>
              <Link href="/settings?tab=costs" className="text-sm font-medium text-teal-700 hover:text-teal-900">
                Set lab costs and dentist shares
              </Link>
            </div>
            <dl className="grid gap-4 sm:grid-cols-4">
              {[
                { label: "Fees booked", pence: marginTotal.feePence },
                { label: "Lab and materials", pence: -marginTotal.labPence },
                { label: "Dentists' shares", pence: -marginTotal.dentistPence },
                { label: "Practice margin", pence: marginTotal.marginPence, strong: true },
              ].map((x) => (
                <div key={x.label}>
                  <dt className="text-[13px] text-ink-500">{x.label}</dt>
                  <dd className={cn("mt-1 font-mono text-xl tabular-nums", x.strong ? "text-teal-700" : "text-ink-900")}>
                    {x.pence < 0 ? "−" : ""}
                    {formatGBP(Math.abs(x.pence))}
                  </dd>
                </div>
              ))}
            </dl>
            {marginByCategory.size > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-900/8 text-left text-[13px] text-ink-500">
                    <th className="py-2 pr-3 font-medium">Kind of treatment</th>
                    <th className="py-2 pr-3 text-right font-medium">Fees</th>
                    <th className="py-2 pr-3 text-right font-medium">Practice margin</th>
                    <th className="py-2 text-right font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(marginByCategory.entries())
                    .sort((a, b) => b[1].feePence - a[1].feePence)
                    .map(([cat, m]) => (
                      <tr key={cat} className="border-b border-ink-900/5 last:border-0">
                        <td className="py-2 pr-3 text-ink-900">{cat}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatGBP(m.feePence)}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatGBP(m.marginPence)}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{percent(marginRate(m))}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            <p className="text-[13px] leading-relaxed text-ink-500">
              Fee, minus the lab &amp; materials % for that kind of treatment, minus the treating dentist&rsquo;s share of
              the rest. Only owners see this.
              {marginTotal.incomplete ? " Some lab costs or dentist shares aren't set yet, so they count as 0% for now." : ""}
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="space-y-4">
          <div>
            <h2 className="font-display text-xl text-ink-900">
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
                <dt className="flex items-center gap-2 text-[13px] font-medium text-ink-500">
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
        <h2 className="mb-3 font-display text-xl text-ink-900">By treatment</h2>
        {report.byTreatment.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-900/15 px-6 py-10 text-center text-sm text-ink-500">
            No quotes made {periodLabel}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-cream-0">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink-900/8 text-[13px] text-ink-500">
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

      {showByDentist && !dentistFilter && (
        <Link
          href={`/dentists?period=${period}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/8 bg-cream-0 px-5 py-4 hover:border-teal-300"
        >
          <span>
            <span className="block font-medium text-ink-900">Compare dentists</span>
            <span className="block text-sm text-ink-500">
              Booking rate, revenue, days to book and open pipeline for each dentist {periodLabel}.
            </span>
          </span>
          <span className="shrink-0 text-sm font-medium text-teal-700">Open</span>
        </Link>
      )}

      {caseReport.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-xl text-ink-900">Treatment progress</h2>
          <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-cream-0">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink-900/8 text-[13px] text-ink-500">
                  <th className="px-5 py-3 font-medium">Board</th>
                  <th className="px-5 py-3 text-right font-medium">In treatment now</th>
                  <th className="px-5 py-3 text-right font-medium">Overdue now</th>
                  <th className="px-5 py-3 text-right font-medium">Completed</th>
                  <th className="px-5 py-3 text-right font-medium">Completed value</th>
                  <th className="px-5 py-3 text-right font-medium">Average time</th>
                </tr>
              </thead>
              <tbody>
                {caseReport.map((row) => (
                  <tr key={row.boardId ?? "none"} className="border-b border-ink-900/6 last:border-0">
                    <td className="px-5 py-3 text-ink-900">{row.boardId ? (boardNames[row.boardId] ?? "Deleted board") : "Deleted board"}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{row.active}</td>
                    <td className={cn("px-5 py-3 text-right font-mono tabular-nums", row.stuck > 0 && "text-clay-700")}>{row.stuck}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{row.completed}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{formatGBP(row.completedValuePence)}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">
                      {row.averageDays == null ? "–" : `${row.averageDays} day${row.averageDays === 1 ? "" : "s"}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Completed and average time (from going on the board to completed) are for cases completed {periodLabel}.
          </p>
        </div>
      )}

      <div>
        <h2 className="mb-3 font-display text-xl text-ink-900">Follow-up messages{dentistFilter ? " (whole practice)" : ""}</h2>
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
