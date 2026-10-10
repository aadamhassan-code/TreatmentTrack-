import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApproveForm } from "@/components/approval/approval-forms";

export const dynamic = "force-dynamic";

/**
 * Public page the practice owner opens from the approval link. No login: the
 * one-time link is the key (only its hash is stored). Shows exactly what
 * they're agreeing to before they approve.
 */
export default async function ApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const hash = createHash("sha256").update(token).digest("hex");

  const { data: practice } = await admin
    .from("practices")
    .select("id, name, owner_approved_at")
    .eq("approval_token_hash", hash)
    .eq("requires_owner_approval", true)
    .maybeSingle();

  let requester = "A dentist at your practice";
  if (practice) {
    const { data: holder } = await admin
      .from("practice_members")
      .select("user_id, display_name")
      .eq("practice_id", practice.id)
      .eq("role", "owner")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (holder) {
      const { data } = await admin.auth.admin.getUserById(holder.user_id);
      requester = [holder.display_name, data.user?.email && `(${data.user.email})`].filter(Boolean).join(" ") || requester;
    }
  }

  return (
    <main className="min-h-screen bg-cream-50 px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="font-display text-lg font-medium text-teal-900">TreatmentTrack</p>
        {!practice || practice.owner_approved_at ? (
          <div className="rounded-xl border border-ink-900/8 bg-cream-0 p-6 text-sm text-ink-700">
            This approval link has expired or was already used. If you still need to approve, ask the dentist to send
            you a new link.
          </div>
        ) : (
          <div className="space-y-6 rounded-xl border border-ink-900/8 bg-cream-0 p-6">
            <div>
              <h1 className="font-display text-2xl font-medium text-ink-900">
                Approve follow-up messages for {practice.name}
              </h1>
              <p className="mt-2 text-sm text-ink-700">
                <strong>{requester}</strong> has set up TreatmentTrack to follow up their patients who were quoted for
                treatment at {practice.name} but haven&rsquo;t booked. Because the messages go out in the
                practice&rsquo;s name and the patients&rsquo; details belong to the practice, nothing is sent without
                your approval.
              </p>
            </div>
            <div className="text-sm text-ink-700">
              <p className="font-semibold text-ink-900">What you&rsquo;re agreeing to</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  Up to four polite follow-up texts or emails over 30 days to patients this dentist quoted who
                  haven&rsquo;t booked, sent in {practice.name}&rsquo;s name.
                </li>
                <li>
                  Only patients who were offered the chance to opt out of follow-up when they were quoted. Every
                  message includes an opt-out, and a STOP reply stops all messages straight away.
                </li>
                <li>
                  {practice.name} remains responsible for its patients&rsquo; data (the data controller). TreatmentTrack
                  only uses the details the dentist enters to send these follow-ups.
                </li>
                <li>You can withdraw approval at any time by asking the dentist to stop, or by contacting us.</li>
              </ul>
            </div>
            <ApproveForm token={token} practiceName={practice.name} />
          </div>
        )}
      </div>
    </main>
  );
}
