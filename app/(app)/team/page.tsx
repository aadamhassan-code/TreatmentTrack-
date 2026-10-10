import { Card, CardBody } from "@/components/ui/card";
import { requireOwner } from "@/lib/practice";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteForm, MemberActions, AddLocationForm } from "@/components/team/team-forms";

const PLAN_LABELS: Record<string, string> = {
  solo: "Solo",
  practice: "Practice",
  multisite: "Multisite",
  enterprise: "Enterprise",
};

export default async function TeamPage() {
  const { practice, userId } = await requireOwner();
  // Owner-checked above. The service role is needed to read team members'
  // email addresses, which live in Supabase Auth rather than our tables.
  const admin = createAdminClient();
  const rootId = practice.billing_practice_id ?? practice.id;

  const [{ data: members }, { data: locations }] = await Promise.all([
    admin
      .from("practice_members")
      .select("id, user_id, role, created_at")
      .eq("practice_id", practice.id)
      .order("created_at"),
    admin
      .from("practices")
      .select("id, name, billing_practice_id, plan")
      .or(`id.eq.${rootId},billing_practice_id.eq.${rootId}`)
      .order("created_at"),
  ]);

  const team = await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return {
        ...m,
        email: data.user?.email ?? "Unknown",
        pending: !data.user?.last_sign_in_at,
      };
    })
  );

  const plan = locations?.find((l) => l.id === rootId)?.plan ?? practice.plan;
  const limit = plan === "multisite" ? 5 : plan === "enterprise" ? null : 1;
  const locationCount = locations?.length ?? 1;
  const canAddLocation = limit == null || locationCount < limit;

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink-900">Team & locations</h1>
        <p className="mt-1 text-sm text-ink-500">{practice.name}</p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-medium text-ink-900">Team</h2>
          <p className="mt-1 text-sm text-ink-500">
            <strong>Owners</strong> can do everything, including Settings, message templates, this page and
            adding locations. <strong>Staff</strong> can use the dashboard, add and import quotes, log
            visits and see reports.
          </p>
        </div>
        <Card>
          <CardBody className="divide-y divide-ink-900/6 p-0">
            {team.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    {m.email}
                    {m.user_id === userId && <span className="ml-2 text-xs font-normal text-ink-500">(you)</span>}
                  </p>
                  {m.pending && <p className="text-xs text-ink-500">Invited — hasn&rsquo;t signed in yet</p>}
                </div>
                <MemberActions
                  memberId={m.id}
                  role={m.role as "owner" | "staff"}
                  isSelf={m.user_id === userId}
                />
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <InviteForm />
          </CardBody>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-medium text-ink-900">Locations</h2>
          <p className="mt-1 text-sm text-ink-500">
            Your {PLAN_LABELS[plan ?? ""] ?? ""} plan covers{" "}
            {limit == null ? "as many locations as you need" : limit === 1 ? "one location" : `up to ${limit} locations`}.
            Each location has its own patients, quotes, settings and team.
          </p>
        </div>
        <Card>
          <CardBody className="divide-y divide-ink-900/6 p-0">
            {(locations ?? []).map((l) => (
              <div key={l.id} className="flex items-center justify-between px-6 py-3 text-sm">
                <span className="text-ink-900">
                  {l.name}
                  {l.id === practice.id && <span className="ml-2 text-xs text-ink-500">(current)</span>}
                </span>
                <span className="text-xs text-ink-500">{l.billing_practice_id ? "Location" : "Pays the subscription"}</span>
              </div>
            ))}
          </CardBody>
        </Card>
        {canAddLocation && limit !== 1 ? (
          <Card>
            <CardBody>
              <AddLocationForm />
            </CardBody>
          </Card>
        ) : (
          <p className="text-sm text-ink-500">
            {limit === 1
              ? "To run more than one location from this account, upgrade to Multisite."
              : "You've used all the locations on your plan. Request a callback from the pricing page to add more."}
          </p>
        )}
      </section>
    </div>
  );
}
