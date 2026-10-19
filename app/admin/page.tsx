import { reportWindows, requirePlatformAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { Card } from "@/components/ui/card";
import { formatDate, formatGBP } from "@/lib/utils";
import { OPEN_STATUSES } from "@/lib/types";
import { isMissingSchema } from "@/lib/supabase/compat";

export const dynamic = "force-dynamic";

interface PracticeRow {
  id: string;
  name: string;
  plan: string | null;
  status: string;
  created_at: string;
}
interface TreatmentRow {
  practice_id: string;
  status: string;
  value_pence: number;
  converted_at: string | null;
}
interface StepRow {
  practice_id: string;
  status: string;
  channel: string;
  error: string | null;
  scheduled_for: string;
}
interface IntegrationRow {
  practice_id: string;
  provider: string;
  account_label: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
}
interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  practice_count: number | null;
  status: string;
  created_at: string;
  topic?: string;
  practice_name?: string | null;
  message?: string | null;
}

const TOPIC_LABEL: Record<string, string> = { sales: "Sales", walkthrough: "Walkthrough", support: "Support" };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-[13px] text-ink-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-medium text-ink-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-300">{sub}</p>}
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl text-ink-900">{children}</h2>;
}

const PLAN_LABEL: Record<string, string> = {
  solo: "Solo",
  practice: "Practice",
  multisite: "Multisite",
  enterprise: "Enterprise",
};

/**
 * Platform overview for the TreatmentTrack team: every practice, money
 * tracked and recovered, message delivery health, sync errors and sales
 * leads. Reads with the service role across practices — gated by
 * requirePlatformAdmin (via the layout too), and strictly read-only.
 * Whole-table reads are fine at the current scale; revisit with SQL
 * aggregates once practice count grows past a few hundred.
 */
export default async function AdminOverviewPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { d7, d30 } = reportWindows();

  const [practices, treatments, steps, integrations, leads, pendingCandidates, optOuts30d] =
    await Promise.all([
      fetchAll<PracticeRow>((from, to) =>
        admin.from("practices").select("id, name, plan, status, created_at").order("id").range(from, to)
      ),
      fetchAll<TreatmentRow>((from, to) =>
        admin.from("treatments").select("practice_id, status, value_pence, converted_at").order("id").range(from, to)
      ),
      fetchAll<StepRow>((from, to) =>
        admin
          .from("sequence_steps")
          .select("practice_id, status, channel, error, scheduled_for")
          .gte("scheduled_for", d30)
          .order("id")
          .range(from, to)
      ),
      fetchAll<IntegrationRow>((from, to) =>
        admin
          .from("integrations")
          .select("practice_id, provider, account_label, last_synced_at, last_sync_error")
          .order("id")
          .range(from, to)
      ),
      (async () => {
        const recent = (cols: string) =>
          admin.from("callback_requests").select(cols).order("created_at", { ascending: false }).limit(30);
        let res = await recent("id, name, email, phone, practice_count, status, created_at, topic, practice_name, message");
        if (isMissingSchema(res.error)) res = await recent("id, name, email, phone, practice_count, status, created_at, message");
        return (res.data ?? []) as unknown as LeadRow[];
      })(),
      admin
        .from("pms_quote_candidates")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .then(({ count }) => count ?? 0),
      admin
        .from("patients")
        .select("id", { count: "exact", head: true })
        .gte("opted_out_at", d30)
        .then(({ count }) => count ?? 0),
    ]);

  const open = treatments.filter((t) => (OPEN_STATUSES as readonly string[]).includes(t.status));
  const converted = treatments.filter((t) => t.status === "converted");
  const converted30d = converted.filter((t) => t.converted_at && t.converted_at >= d30);
  const sum = (rows: { value_pence: number }[]) => rows.reduce((a, t) => a + t.value_pence, 0);

  const sent30d = steps.filter((s) => s.status === "sent");
  const failed7d = steps.filter((s) => s.status === "failed" && s.scheduled_for >= d7);
  const livePractices = practices.filter((p) => p.status === "active" || p.status === "past_due");

  const byPractice = (practiceId: string) => ({
    open: open.filter((t) => t.practice_id === practiceId),
    converted: converted.filter((t) => t.practice_id === practiceId),
    integration: integrations.find((i) => i.practice_id === practiceId),
  });

  const practiceName = new Map(practices.map((p) => [p.id, p.name]));
  const syncProblems = integrations.filter((i) => i.last_sync_error);
  const recentFailures = failed7d.slice(-10).reverse();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl text-ink-900">Back office</h1>
        <p className="mt-2 text-sm text-ink-500">
          Every practice on the platform, the money being tracked, and anything that needs a look.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Live practices" value={String(livePractices.length)} sub={`${practices.length} total`} />
        <Stat label="Open quote value" value={formatGBP(sum(open))} sub={`${open.length} quotes in follow-up`} />
        <Stat label="Booked — last 30 days" value={formatGBP(sum(converted30d))} sub={`${formatGBP(sum(converted))} all-time`} />
        <Stat
          label="Messages — last 30 days"
          value={String(sent30d.length)}
          sub={`${failed7d.length} failed in 7 days · ${optOuts30d} opt-outs in 30`}
        />
      </div>

      <section className="space-y-4">
        <SectionTitle>Practices</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-ink-900/8 text-left text-[13px] text-ink-500">
                <th className="px-5 py-3 font-medium">Practice</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Open quotes</th>
                <th className="px-5 py-3 font-medium">Booked value</th>
                <th className="px-5 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {practices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-500">
                    No practices yet. The first signup will appear here.
                  </td>
                </tr>
              )}
              {practices.map((p) => {
                const d = byPractice(p.id);
                return (
                  <tr key={p.id} className="border-b border-ink-900/5 last:border-0">
                    <td className="px-5 py-3 font-medium text-ink-900">
                      {p.name}
                      {d.integration && (
                        <span
                          className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                            d.integration.last_sync_error ? "bg-rose text-clay-700" : "bg-sage text-teal-800"
                          }`}
                        >
                          {d.integration.provider}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-700">{p.plan ? (PLAN_LABEL[p.plan] ?? p.plan) : "—"}</td>
                    <td className="px-5 py-3 text-ink-700">{p.status}</td>
                    <td className="px-5 py-3 font-mono text-ink-700">
                      {d.open.length} · {formatGBP(sum(d.open))}
                    </td>
                    <td className="px-5 py-3 font-mono text-ink-700">{formatGBP(sum(d.converted))}</td>
                    <td className="px-5 py-3 text-ink-500">{formatDate(p.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionTitle>Needs a look</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="px-5 py-5">
            <p className="text-sm font-semibold text-ink-900">Sync problems</p>
            {syncProblems.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">
                All connected practice management systems synced cleanly. {pendingCandidates} imported
                plan{pendingCandidates === 1 ? "" : "s"} waiting for staff review.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {syncProblems.map((i) => (
                  <li key={i.practice_id} className="rounded-lg bg-rose px-3 py-2 text-clay-700">
                    <span className="font-medium">{practiceName.get(i.practice_id) ?? i.practice_id}</span> ·{" "}
                    {i.provider}: {i.last_sync_error}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="px-5 py-5">
            <p className="text-sm font-semibold text-ink-900">Failed messages — last 7 days</p>
            {recentFailures.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">Nothing failed. Messages are going out normally.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {recentFailures.map((s, i) => (
                  <li key={i} className="rounded-lg bg-cream-100 px-3 py-2 text-ink-700">
                    <span className="font-medium">{practiceName.get(s.practice_id) ?? "Unknown practice"}</span> ·{" "}
                    {s.channel} due {formatDate(s.scheduled_for)}: {s.error ?? "No error recorded"}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Leads and support requests</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-ink-900/8 text-left text-[13px] text-ink-500">
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Message</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Received</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-500">
                    No requests yet.
                  </td>
                </tr>
              )}
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-ink-900/5 last:border-0">
                  <td className="px-5 py-3 text-ink-700">{TOPIC_LABEL[l.topic ?? "sales"] ?? l.topic}</td>
                  <td className="px-5 py-3 font-medium text-ink-900">
                    {l.name}
                    {l.practice_name && <span className="block text-[13px] font-normal text-ink-500">{l.practice_name}</span>}
                  </td>
                  <td className="px-5 py-3 text-ink-700">
                    {l.email}
                    {l.phone && <span className="block text-[13px] text-ink-500">{l.phone}</span>}
                    {l.practice_count != null && <span className="block text-[13px] text-ink-500">{l.practice_count} practices</span>}
                  </td>
                  <td className="max-w-xs px-5 py-3 text-[13px] text-ink-700">
                    <span className="line-clamp-3">{l.message ?? "–"}</span>
                  </td>
                  <td className="px-5 py-3 text-ink-700">{l.status}</td>
                  <td className="px-5 py-3 text-ink-500">{formatDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
