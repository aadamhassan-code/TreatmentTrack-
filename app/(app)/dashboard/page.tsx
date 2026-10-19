import { LedgerStat } from "@/components/ui/ledger-stat";
import { TreatmentsTable } from "@/components/dashboard/treatments-table";
import { LinkButton } from "@/components/ui/button";
import { formatGBP, ukDate, weekWindow } from "@/lib/utils";
import { periodStart } from "@/lib/reports";
import { displayStatus } from "@/lib/treatment-status";
import { listTreatingDentists, requireCurrentPractice } from "@/lib/practice";
import { DentistFilter } from "@/components/dashboard/dentist-filter";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { OPEN_STATUSES, type Treatment } from "@/lib/types";
import { isStuck, type CaseRow, type CaseStage } from "@/lib/cases";
import Link from "next/link";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { practice, role, userId, treatsPatients } = await requireCurrentPractice();
  const supabase = await createClient();
  const isDentist = role === "dentist";

  // Owners and staff can narrow the dashboard to one dentist ("me" = their
  // own quotes). Dentist logins only ever see their own (row-level security).
  const dentists = isDentist ? [] : await listTreatingDentists(practice.id);
  const rawFilter = (await searchParams).dentist;
  const filter = typeof rawFilter === "string" ? (rawFilter === "me" ? userId : rawFilter) : "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = <Q extends { eq: any; is: any }>(q: Q): Q =>
    !filter || isDentist ? q : filter === "unassigned" ? q.is("dentist_user_id", null) : q.eq("dentist_user_id", filter);
  const dentistNames = Object.fromEntries(dentists.map((d) => [d.userId, d.name]));

  // The 1st of this month in UK time. The query starts a day earlier so no
  // UK-time booking is missed; the exact cut-off is applied below.
  const monthStart = periodStart("month")!;
  const queryFrom = new Date(`${monthStart}T00:00:00Z`);
  queryFrom.setUTCDate(queryFrom.getUTCDate() - 1);

  const [open, bookedRecently, { data: recentlyClosed }, activeCases, { data: caseStages }, last90] = await Promise.all([
    // Open quotes, biggest first — the ones most worth a phone call today.
    fetchAll<Treatment>((from, to) =>
      scoped(supabase
        .from("treatments")
        .select("*, patient:patients(*), sequence_steps(status, error, scheduled_for)")
        .eq("practice_id", practice.id))
        .in("status", OPEN_STATUSES)
        .order("value_pence", { ascending: false })
        .order("quoted_on", { ascending: true })
        .order("id")
        .range(from, to)
    ),
    fetchAll<{ value_pence: number; converted_at: string }>((from, to) =>
      scoped(supabase
        .from("treatments")
        .select("value_pence, converted_at")
        .eq("practice_id", practice.id))
        .eq("status", "converted")
        .gte("converted_at", queryFrom.toISOString())
        .order("id")
        .range(from, to)
    ),
    scoped(supabase
      .from("treatments")
      .select("*, patient:patients(*)")
      .eq("practice_id", practice.id))
      .in("status", ["converted", "declined", "lost"])
      .order("updated_at", { ascending: false })
      .limit(10),
    fetchAll<Pick<CaseRow, "status" | "stage_id" | "stage_entered_at">>((from, to) =>
      scoped(supabase.from("cases").select("status, stage_id, stage_entered_at").eq("practice_id", practice.id))
        .eq("status", "active")
        .order("id")
        .range(from, to)
    ),
    supabase.from("case_stages").select("id, expected_days").eq("practice_id", practice.id),
    fetchAll<{ status: string }>((from, to) =>
      scoped(supabase.from("treatments").select("status").eq("practice_id", practice.id))
        .gte("quoted_on", periodStart("90d")!)
        .order("id")
        .range(from, to)
    ),
  ]);

  const stageById = new Map(((caseStages ?? []) as Pick<CaseStage, "id" | "expected_days">[]).map((s) => [s.id, s]));
  const overdueCases = activeCases.filter((c) => isStuck(c, c.stage_id ? stageById.get(c.stage_id) : undefined)).length;

  const bookedThisMonth = bookedRecently.filter((t) => ukDate(t.converted_at) >= monthStart);
  // Opted-out patients won't get any more messages, so their quotes stay
  // listed (they might still book) but aren't counted as pipeline.
  const optedOut = open.filter((t) => displayStatus(t) === "opted_out");
  const following = open.filter((t) => displayStatus(t) !== "opted_out");
  const pipelinePence = following.reduce((sum, t) => sum + t.value_pence, 0);
  const recoveredPence = bookedThisMonth.reduce((sum, t) => sum + t.value_pence, 0);

  // Booking rate: of the quotes made in the last 90 days, how many booked.
  const booked90 = last90.filter((t) => t.status === "converted").length;
  const bookingRate = last90.length ? Math.round((booked90 / last90.length) * 100) : null;

  // Messages due in the next 7 days, and any that failed in the last 7.
  const { ahead: weekAhead, ago: weekAgo } = weekWindow();
  const dueThisWeek = following.reduce(
    (n, t) => n + (t.sequence_steps ?? []).filter((s) => s.status === "pending" && (s.scheduled_for ?? "") <= weekAhead).length,
    0
  );
  const failed = following
    .filter((t) => (t.sequence_steps ?? []).some((s) => s.status === "failed" && (s.scheduled_for ?? "") >= weekAgo))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink-900">
            {isDentist || filter === userId ? "My quotes" : "Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {practice.name}
            {!isDentist && filter && filter !== userId && (
              <> | {filter === "unassigned" ? "Not assigned to a dentist" : (dentistNames[filter] ?? "One dentist")}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isDentist && dentists.length > 0 && (
            <div data-tour="dentist-filter">
              <DentistFilter dentists={dentists} value={filter} myId={treatsPatients ? userId : null} />
            </div>
          )}
          <LinkButton href="/treatments/import" variant="secondary" data-tour="nav-/treatments/import">
            Import spreadsheet
          </LinkButton>
          <LinkButton href="/treatments/new">Add a quote</LinkButton>
        </div>
      </div>

      <div data-tour="pipeline" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <LedgerStat
          label="Open pipeline"
          value={formatGBP(pipelinePence)}
          caption={
            `${following.length} quote${following.length === 1 ? "" : "s"} being followed up` +
            (optedOut.length ? `, ${optedOut.length} opted out (not counted)` : "")
          }
        />
        <LedgerStat
          label="Booked this month"
          value={formatGBP(recoveredPence)}
          caption={`${bookedThisMonth.length} quote${bookedThisMonth.length === 1 ? "" : "s"} booked`}
          accent
        />
        <LedgerStat
          label="Booking rate"
          value={bookingRate == null ? "–" : `${bookingRate}%`}
          caption={`of ${last90.length} quote${last90.length === 1 ? "" : "s"} made in the last 90 days`}
        />
        <LedgerStat
          label="Messages this week"
          value={String(dueThisWeek)}
          caption="due to go out in the next 7 days"
        />
      </div>

      {(overdueCases > 0 || failed.length > 0) && (
        <section aria-label="Needs attention" className="space-y-2">
          {overdueCases > 0 && (
            <Link
              href={!isDentist && typeof rawFilter === "string" ? `/cases?dentist=${encodeURIComponent(rawFilter)}` : "/cases"}
              className="flex items-center justify-between gap-3 rounded-lg border border-clay-500/30 bg-clay-100/60 px-4 py-3 text-sm text-clay-700 hover:border-clay-500"
            >
              <span>
                <strong>
                  {overdueCases} patient{overdueCases === 1 ? " is" : "s are"} overdue
                </strong>{" "}
                at a treatment stage. Check they&rsquo;re booked in.
              </span>
              <span className="shrink-0 font-medium">Open cases</span>
            </Link>
          )}
          {failed.length > 0 && (
            <div className="rounded-lg border border-gold-500/40 bg-gold-100 px-4 py-3 text-sm text-ink-900">
              <p>
                <strong>Some messages couldn&rsquo;t be sent this week.</strong> Check these patients&rsquo; details:
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {failed.map((t) => (
                  <li key={t.id}>
                    <Link href={`/patients/${t.patient?.id}`} className="font-medium text-teal-800 underline underline-offset-2">
                      {t.patient?.full_name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div data-tour="open-quotes">
        <h2 className="font-display text-xl text-ink-900">Open quotes</h2>
        <p className="mb-3 mt-1 text-sm text-ink-500">
          Highest value first. Mark a quote Booked when the patient books and their messages stop.
        </p>
        <TreatmentsTable treatments={open} mode="open" dentistNames={isDentist ? undefined : dentistNames} />
      </div>

      {(recentlyClosed?.length ?? 0) > 0 && (
        <div>
          <h2 className="mb-3 font-display text-xl text-ink-900">Recently closed</h2>
          <TreatmentsTable
            treatments={(recentlyClosed ?? []) as unknown as Treatment[]}
            mode="closed"
            dentistNames={isDentist ? undefined : dentistNames}
          />
        </div>
      )}
    </div>
  );
}
