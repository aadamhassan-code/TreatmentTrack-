import Link from "next/link";
import { redirect } from "next/navigation";
import { cn, formatGBP } from "@/lib/utils";
import { listTreatingDentists, requireCurrentPractice } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { REPORT_PERIODS, parsePeriod, periodStart } from "@/lib/reports";
import { buildDentistPerformance, type PerfTreatment } from "@/lib/performance";
import { loadMarginInputs } from "@/lib/margin-inputs";
import { marginRate } from "@/lib/margins";

function pct(rate: number | null) {
  return rate == null ? "–" : `${Math.round(rate * 100)}%`;
}

/**
 * Every treating dentist side by side for a period: what they quoted, what
 * booked, how fast, what's still open, and (owners) estimated margin.
 */
export default async function DentistsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { practice, role } = await requireCurrentPractice();
  if (role === "dentist") redirect("/reports");
  const supabase = await createClient();
  const period = parsePeriod((await searchParams).period);
  const from = periodStart(period);
  const phrase = REPORT_PERIODS.find((p) => p.value === period)!.phrase;

  const [treatments, dentists, margins, activeCases] = await Promise.all([
    fetchAll<PerfTreatment>((lo, hi) =>
      supabase
        .from("treatments")
        .select("treatment_type, value_pence, status, quoted_on, converted_at, dentist_user_id")
        .eq("practice_id", practice.id)
        .order("id")
        .range(lo, hi)
    ),
    listTreatingDentists(practice.id),
    loadMarginInputs(supabase, practice.id, role),
    fetchAll<{ dentist_user_id: string | null }>((lo, hi) =>
      supabase.from("cases").select("dentist_user_id").eq("practice_id", practice.id).eq("status", "active").order("id").range(lo, hi)
    ),
  ]);

  const rows = buildDentistPerformance(treatments, from, margins ?? undefined);
  const names = new Map(dentists.map((d) => [d.userId, d.name]));
  // Every treating dentist appears, even with nothing in the period.
  for (const d of dentists) {
    if (!rows.some((r) => r.dentistUserId === d.userId)) {
      rows.push({
        dentistUserId: d.userId,
        quoted: { count: 0, valuePence: 0 },
        booked: { count: 0, valuePence: 0 },
        bookingRate: null,
        recovered: { count: 0, valuePence: 0 },
        avgDaysToBook: null,
        open: { count: 0, valuePence: 0 },
        margin: margins ? { feePence: 0, labPence: 0, dentistPence: 0, marginPence: 0, incomplete: false } : null,
      });
    }
  }
  const casesBy = new Map<string | null, number>();
  for (const c of activeCases) casesBy.set(c.dentist_user_id, (casesBy.get(c.dentist_user_id) ?? 0) + 1);
  const showMargin = margins != null;
  const anyIncomplete = rows.some((r) => r.margin?.incomplete);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink-900">Dentists</h1>
          <p className="mt-1 text-sm text-ink-500">
            How each dentist&rsquo;s quotes are converting {phrase}. Open a dentist to see their full report.
          </p>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-lg border border-ink-900/10 bg-cream-0 p-1" aria-label="Period">
          {REPORT_PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/dentists?period=${p.value}`}
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

      {dentists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-900/15 px-6 py-14 text-center">
          <p className="font-medium text-ink-700">No dentists set up yet</p>
          <p className="mt-1 text-sm text-ink-500">
            {role === "owner" ? (
              <>
                Add your dentists on the{" "}
                <Link href="/team" className="font-medium text-teal-700 underline">
                  Team page
                </Link>{" "}
                (or tick &ldquo;Sees patients&rdquo; for yourself), then assign quotes to them.
              </>
            ) : (
              "Ask the practice owner to add dentists on the Team page."
            )}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-cream-0">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-900/8 text-[13px] text-ink-500">
                <th className="px-5 py-3 font-medium">Dentist</th>
                <th className="px-4 py-3 text-right font-medium">Quoted</th>
                <th className="px-4 py-3 text-right font-medium">Booking rate</th>
                <th className="px-4 py-3 text-right font-medium">Revenue booked</th>
                <th className="px-4 py-3 text-right font-medium">Days to book</th>
                <th className="px-4 py-3 text-right font-medium">Open pipeline</th>
                <th className="px-4 py-3 text-right font-medium">In treatment</th>
                {showMargin && <th className="px-5 py-3 text-right font-medium">Est. practice margin</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const name = r.dentistUserId ? (names.get(r.dentistUserId) ?? "Former team member") : "Not assigned";
                const id = r.dentistUserId ?? "unassigned";
                return (
                  <tr key={id} className="border-b border-ink-900/5 last:border-0 hover:bg-cream-50/60">
                    <td className="px-5 py-3.5">
                      <Link href={`/reports?dentist=${id}&period=${period}`} className="font-medium text-ink-900 hover:text-teal-700 hover:underline">
                        {name}
                      </Link>
                      <span className="mt-0.5 flex gap-3 text-[13px]">
                        <Link href={`/dashboard?dentist=${id}`} className="text-ink-500 hover:text-teal-700">
                          Quotes
                        </Link>
                        <Link href={`/patients?dentist=${id}`} className="text-ink-500 hover:text-teal-700">
                          Patients
                        </Link>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-mono text-ink-900">{formatGBP(r.quoted.valuePence)}</span>
                      <span className="block text-[13px] text-ink-500">{r.quoted.count} quotes</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-ink-900">{pct(r.bookingRate)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-mono text-ink-900">{formatGBP(r.recovered.valuePence)}</span>
                      <span className="block text-[13px] text-ink-500">{r.recovered.count} booked</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-ink-700">{r.avgDaysToBook ?? "–"}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-mono text-ink-900">{formatGBP(r.open.valuePence)}</span>
                      <span className="block text-[13px] text-ink-500">{r.open.count} open</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-ink-700">{casesBy.get(r.dentistUserId) ?? 0}</td>
                    {showMargin && (
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-mono text-ink-900">{formatGBP(r.margin?.marginPence ?? 0)}</span>
                        <span className="block text-[13px] text-ink-500">
                          {pct(r.margin ? marginRate(r.margin) : null)}
                          {r.margin?.incomplete ? " *" : ""}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-1.5 text-[13px] leading-relaxed text-ink-500">
        <p>
          <strong className="font-medium text-ink-700">Quoted</strong> and <strong className="font-medium text-ink-700">booking rate</strong> cover quotes made {phrase}.{" "}
          <strong className="font-medium text-ink-700">Revenue booked</strong> counts bookings made {phrase}, whenever the patient was quoted.{" "}
          <strong className="font-medium text-ink-700">Days to book</strong> is the average from quote to booking.
        </p>
        {showMargin && (
          <p>
            Estimated practice margin = fee, minus lab &amp; materials, minus the dentist&rsquo;s share of the rest.{" "}
            {anyIncomplete ? "* Some inputs aren't set yet, so they're counted as 0%. " : ""}
            Set dentist shares on the{" "}
            <Link href="/team" className="font-medium text-teal-700 underline">
              Team page
            </Link>{" "}
            and lab costs in{" "}
            <Link href="/settings?tab=costs" className="font-medium text-teal-700 underline">
              Settings
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
