import Link from "next/link";
import { Search } from "lucide-react";
import { requireCurrentPractice } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatGBP } from "@/lib/utils";
import { OPEN_STATUSES } from "@/lib/types";

const PAGE_SIZE = 100;

interface PatientRow {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  opted_out_at: string | null;
  created_at: string;
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { practice } = await requireCurrentPractice();
  const supabase = await createClient();
  const sp = await searchParams;
  const raw = sp.q;
  const q = typeof raw === "string" ? raw.trim().slice(0, 80) : "";
  const justErased = sp.erased === "1";

  let query = supabase
    .from("patients")
    .select("id, full_name, phone, email, opted_out_at, created_at")
    .eq("practice_id", practice.id)
    .is("erased_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (q) {
    // Search by name, or by phone digits ("07700 900123" finds +447700900123).
    const digits = q.replace(/\D/g, "").replace(/^0/, "");
    const safe = q.replace(/[%,()]/g, " ");
    query = digits.length >= 4
      ? query.or(`full_name.ilike.%${safe}%,phone.ilike.%${digits}%`)
      : query.ilike("full_name", `%${safe}%`);
  }
  const { data } = await query;
  const patients = (data ?? []) as PatientRow[];

  const ids = patients.map((p) => p.id);
  const { data: treatments } = ids.length
    ? await supabase.from("treatments").select("patient_id, status, value_pence").in("patient_id", ids)
    : { data: [] };
  const openByPatient = new Map<string, { count: number; pence: number }>();
  for (const t of treatments ?? []) {
    if (!(OPEN_STATUSES as readonly string[]).includes(t.status)) continue;
    const cur = openByPatient.get(t.patient_id) ?? { count: 0, pence: 0 };
    openByPatient.set(t.patient_id, { count: cur.count + 1, pence: cur.pence + t.value_pence });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink-900">Patients</h1>
          <p className="mt-1 text-sm text-ink-500">
            Everyone you&rsquo;ve quoted. Open a patient to see their quotes, messages and consent history, or to
            export or erase their data.
          </p>
        </div>
      </div>

      {justErased && (
        <p className="rounded-lg border border-teal-700/20 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          The patient has been erased. The erasure is recorded in your audit log (Settings → Privacy &amp; security).
        </p>
      )}

      <form className="relative max-w-md" role="search">
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
        <label htmlFor="patient-search" className="sr-only">
          Search patients
        </label>
        <input
          id="patient-search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or mobile number"
          className="w-full rounded-lg border border-ink-900/15 bg-cream-0 py-2.5 pl-10 pr-3.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
        />
      </form>

      {patients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-900/15 px-6 py-14 text-center">
          <p className="font-medium text-ink-700">{q ? `No patients match “${q}”` : "No patients yet"}</p>
          <p className="mt-1 text-sm text-ink-500">
            {q ? "Check the spelling, or search by mobile number instead." : "Patients appear here when you add or import a quote."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-900/8 bg-cream-0">
          <ul className="divide-y divide-ink-900/6">
            {patients.map((p) => {
              const open = openByPatient.get(p.id);
              return (
                <li key={p.id}>
                  <Link
                    href={`/patients/${p.id}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-cream-50 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_auto]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-900">{p.full_name}</span>
                      <span className="block truncate text-[13px] text-ink-500 sm:hidden">{p.phone}</span>
                    </span>
                    <span className="hidden truncate text-sm text-ink-700 sm:block">{p.phone}</span>
                    <span className="hidden text-sm text-ink-700 sm:block">
                      {open ? (
                        <>
                          {open.count} open <span className="font-mono text-ink-500">{formatGBP(open.pence)}</span>
                        </>
                      ) : (
                        <span className="text-ink-300">No open quotes</span>
                      )}
                    </span>
                    <span className="justify-self-end text-right">
                      {p.opted_out_at ? (
                        <span className="rounded bg-rose px-1.5 py-0.5 text-xs font-medium text-ink-900">Opted out</span>
                      ) : (
                        <span className="text-[13px] text-ink-500">Added {formatDate(p.created_at)}</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {patients.length === PAGE_SIZE && (
        <p className="text-sm text-ink-500">Showing the {PAGE_SIZE} most recent. Search to find anyone else.</p>
      )}
    </div>
  );
}
